const express = require("express");
const path = require("path");
const session = require("express-session");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using https
  })
);

// Define locations with ownership information
let locations = [
  {
    name: "Kirche Eichberg",
    lat: 47.346416,
    lon: 9.525444,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Fussballfeld Lagerhaus",
    lat: 47.342758,
    lon: 9.513821,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Sportplatz Dorf",
    lat: 47.345082,
    lon: 9.523095,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Reservoir",
    lat: 47.342513,
    lon: 9.512209,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Landgasthof Hölzlisberg",
    lat: 47.34504,
    lon: 9.513739,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Zoologische Station",
    lat: 47.347345,
    lon: 9.525002,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Kartonfabrik",
    lat: 47.339972,
    lon: 9.52177,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Heiterhof",
    lat: 47.344916,
    lon: 9.525751,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
  {
    name: "Seeli Ost",
    lat: 47.345663,
    lon: 9.535846,
    currentOwner: null,
    visible: false,
    lastAttack: [],
  },
];

const maxDistance = 50; // Maximum distance in meters

let attackPossible = true;

const generalDefense = 0.95;

let attackInterval = 60000;

// Define groups and their passwords (in a real app, use a database)
const groups = {
  "Red Team": { password: "red123", capturedLocations: [], defense: 0.95 },
  "Blue Team": { password: "blue123", capturedLocations: [], defense: 0.95 },
  "Green Team": { password: "green123", capturedLocations: [], defense: 0.95 },
  "Orange Team": {
    password: "orange123",
    capturedLocations: [],
    defense: 0.95,
  },
  "Purple Team": {
    password: "purple123",
    capturedLocations: [],
    defense: 0.95,
  },
  "Yellow Team": {
    password: "yellow123",
    capturedLocations: [],
    defense: 0.95,
  },
  Admin: { password: "admin123", capturedLocations: [], defense: 0.95 },
};

initializeLocations();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.get("/groups", (req, res) => {
  res.json(Object.keys(groups));
});

app.get("/status", (req, res) => {
  if (req.session.group === "Admin") {
    res.sendFile(path.join(__dirname, "..", "frontend", "status.html"));
  } else {
    res.status(403).json({ success: false, message: "Access denied" });
  }
});

app.post("/reset", (req, res) => {
  if (req.session.group !== "Admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  } else {
    locations = locations.map((location) => ({
      ...location,
      currentOwner: null,
      visible: false,
    }));
    for (const group in groups) {
      groups[group].capturedLocations = 0;
    }
    res.json({ success: true, message: "Game reset successfully" });
  }
});

app.post("/reveal", (req, res) => {
  if (req.session.group !== "Admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  } else {
    locations = locations.map((location) => ({
      ...location,
      visible: true,
    }));
    res.json({ success: true, message: "Location reveal successfully" });
  }
});

app.post("/attack", (req, res) => {
  if (req.session.group === "Admin") {
    attackPossible = true;
    res.json({ success: true, message: "Attack mode activated" });
  }
});

app.post("/login", async (req, res) => {
  const { group, password } = req.body;
  if (groups[group] && password === groups[group].password) {
    req.session.group = group;
    if (group === "Admin") {
      res.json({
        success: true,
        message: "Logged in successfully",
        statusAccess: true,
        link: "/status",
      });
    } else {
      res.json({ success: true, message: "Logged in successfully" });
    }
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logged out successfully" });
});

app.get("/api/location-status", (req, res) => {
  if (req.session.group) {
    res.json(mapVisibleLocations(req.session.group));
  } else {
    res.status(403).json({ success: false, message: "Access denied" });
  }
});

app.get("/api/group-status", (req, res) => {
  if (req.session.statusAccess) {
    res.json(
      Object.keys(groups).map((group) => ({
        group,
        capturedLocations: groups[group].capturedLocations,
      }))
    );
  } else {
    res.status(403).json({ success: false, message: "Access denied" });
  }
});

app.post("/api/check-location", (req, res) => {
  if (!req.session.group) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const { lat, lon } = req.body;
  const group = req.session.group;
  console.log(`Received location: ${lat}, ${lon} from group: ${group}`);

  let nearestLocation = null;
  let shortestDistance = Infinity;

  for (const location of locations) {
    const distance = calculateDistance(lat, lon, location.lat, location.lon);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestLocation = location;
    }
  }

  let message;
  if (shortestDistance <= maxDistance) {
    message = captureLocation(group, nearestLocation);
  } else {
    message = `Du bist nicht in der Nähe einer Position!`;
  }

  res.json({
    message: message,
    location: nearestLocation,
  });
});

function initializeLocations() {
  const attackTimeStart = Date.now() - attackInterval;
  for (const location of locations) {
    location.currentOwner = null;
    location.visible = false;
    location.lastAttack = [];
    for (const group in groups) {
      location.lastAttack.push({ group: group, time: attackTimeStart });
    }
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
// Check if a group can capture a location and
function captureLocation(group, location) {
  const timeSinceLastAttack = timeSinceLastAttackAttempt(group, location);
  if (canLocationBeCaptured(location, timeSinceLastAttack)) {
    return changeLocationOwner(group, location);
  } else {
    return locationChangeFailed(group, location, timeSinceLastAttack);
  }
}

function isAttackSuccessfull(location) {
  if (location.currentOwner === null) {
    return Math.random() < generalDefense;
  } else {
    return Math.random() < groups[location.currentOwner].defense;
  }
}

function canLocationBeCaptured(location, timeSinceLastAttack) {
  if (
    attackPossible === false &&
    location.currentOwner !== null &&
    timeSinceLastAttack > attackInterval
  ) {
    return false;
  } else {
    return isAttackSuccessfull(location);
  }
}

function timeSinceLastAttackAttempt(group, location) {
  const lastAttack = location.lastAttack.find(
    (attack) => attack.group === group
  );
  if (lastAttack) {
    const timeDifference = Date.now() - lastAttack.time;
    return timeDifference;
  } else {
    return attackInterval + 1;
  }
}

function locationChangeFailed(group, location, timeSinceLastAttack) {
  if (attackPossible === false) {
    return `Du hast die Position ${location.name} nicht übernommen, die Position ist bereits von ${location.currentOwner} besetzt und kann momentan noch nicht übernommen werden.`;
  } else {
    let probability = generalDefense;
    if (location.currentOwner !== null) {
      probability = groups[location.currentOwner].defense;
    }
    if (timeSinceLastAttack < attackInterval) {
      return `Du hast die Position ${
        location.name
      } nicht übernommen, du musst noch ${Math.round(
        (attackInterval - timeSinceLastAttack) / 1000
      )} Sekunden warten.`;
    } else {
      updateAttackAttemptEntry(group, location);
      return `Du hast die Position ${
        location.name
      } nicht übernommen, du hattest eine Chance von ${probability * 100}%`;
    }
  }
}

function updateAttackAttemptEntry(group, location) {
  const lastAttack = location.lastAttack.find(
    (attack) => attack.group === group
  );
  lastAttack.time = Date.now();
  console.log(location.lastAttack);
  
}

function mapVisibleLocations(group) {
  if (group === "Admin") {
    return locations.filter((location) => location.visible);
  } else {
    return locations.filter((location) => location.currentOwner === group);
  }
}

function changeLocationOwner(group, location) {
  updateAttackAttemptEntry(group, location);
  let probability = generalDefense;
  if (location.currentOwner !== null) {
    let previousOwner = groups[location.currentOwner];
    delete groups[location.currentOwner].capturedLocations[location.name];
    probability = previousOwner.defense;
  }
  location.currentOwner = group;
  groups[group].capturedLocations.push(location);
  location.visible = true;
  return `Gratuliere deine Gruppe (${group}) hat die Position ${
    location.name
  } übernommen! Du hattest eine Chance von ${probability * 100}%`;
}

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = {app, server};
