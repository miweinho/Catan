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
    lastAttack: null,
  },
  {
    name: "Fussballfeld Lagerhaus",
    lat: 47.342758,
    lon: 9.513821,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Sportplatz Dorf",
    lat: 47.345082,
    lon: 9.523095,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Reservoir",
    lat: 47.342513,
    lon: 9.512209,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Landgasthof Hölzlisberg",
    lat: 47.34504,
    lon: 9.513739,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Zoologische Station",
    lat: 47.347345,
    lon: 9.525002,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Kartonfabrik",
    lat: 47.339972,
    lon: 9.52177,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Heiterhof",
    lat: 47.344916,
    lon: 9.525751,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
  {
    name: "Seeli Ost",
    lat: 47.345663,
    lon: 9.535846,
    currentOwner: null,
    visible: false,
    lastAttack: null,
  },
];

const maxDistance = 50; // Maximum distance in meters

let attackPossible = false;

const generalDefense = 0.95;

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
    if(req.session.group === "Admin") {
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
  if (location.currentOwner === null) {
    if (isAttackSuccessfull(location)) {
      location.currentOwner = group;
      groups[group].capturedLocations.push(location);
      location.visible = true;
      return `Gratuliere deine Gruppe (${group}) hat die Position ${
        location.name
      } übernommen! Du hattest eine Chance von ${generalDefense * 100}%`;
    } else {
      return `Deine Gruppe (${group}) hat die Position ${
        location.name
      } nicht übernommen! Du hattest eine Chance von ${generalDefense * 100}%`;
    }
  } else {
    if (attackPossible) {
      if (isAttackSuccessfull(location)) {
        let previousOwner = groups[location.currentOwner];
        delete groups[location.currentOwner].capturedLocations[location.name];
        location.currentOwner = group;
        groups[group].capturedLocations.push(location);
        return `Gratuliere deine Gruppe (${group}) hat die Position ${
          location.name
        } übernommen! Du hattest eine Chance von ${
          previousOwner.defense * 100
        }%`;
      } else {
        
        return `Deine Gruppe (${group}) hat die Position ${
          location.name
        } nicht übernommen! Du hattest eine Chance von ${
          previousOwner * 100
        }%`;
      }
    } else {
      return `Die Position ${location.name} gehört bereits ${location.currentOwner}. Du kannst momentan noch nicht angreifen!`;
    }
  }
}

function isAttackSuccessfull(location) {
  if (location.currentOwner === null) {
    return Math.random() < generalDefense;
  } else {
    return Math.random() < groups[location.currentOwner].defense;
  }
}

function mapVisibleLocations(group) {
  if (group === "Admin") {
    return locations.filter((location) => location.visible);
  } else {
    return locations.filter((location) => location.currentOwner === group);
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
