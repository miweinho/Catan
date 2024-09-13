const express = require("express");
const path = require("path");
const session = require("express-session");
var { Timer } = require("easytimer.js");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3000;
let isRady = false;

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

let publicLocations = [];

const ressourceTypes = ["wood", "stone", "iron", "wheat"];

let isReady = false;
// Define locations with ownership information
let locations = [];
let groups = [];
initializeData();


const maxDistance = 50; // Maximum distance in meters

let attackPossible = false;

const generalDefense = 0.95;

let attackInterval = 60000;

let minutes = 10;
let seconds = 0;

var timer = new Timer();

timer.addEventListener('secondsUpdated', function (e) {
  minutes = timer.getTimeValues().minutes;
  seconds = timer.getTimeValues().seconds;
  if(timer.getTimeValues().minutes === 0 && timer.getTimeValues().seconds === 0){
    timer.stop();
    timer.reset();
    getRessources();
  }
});


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

app.get("/user-status", (req, res) => {
  if(req.session.group){
    res.json({group: groups[req.session.group].name, loggedIn: true, timer: {minutes: minutes, seconds: seconds}, locations: publicLocations});
  } else {
    res.json({group: null, loggedIn: false, timer: null});
  }
});

app.post("/reset", (req, res) => {
  if (req.session.group !== "Admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  } else {
    attackPossible = false;
    initializeData();    
    updateVisibleLocations();
    timer.stop();
    
    minutes = 10;
    seconds = 0;
    res.json({ success: true, message: "Game reset successfully" });
  }
});

app.get("/start", (req, res) => {
  if (req.session.group !== "Admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  } else {
    startGame();
    res.json({ success: true, message: "Game started successfully" });
  }
})

app.get("/timer", (req, res) => {
  if(req.session.group) {
    res.json({minutes: minutes, seconds: seconds});
  } else {
    res.status(403).json({ success: false, message: "Access denied" });
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
  if(!isReady) {
    return res.status(503).json({ success: false, message: "Service not available" });
  }
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
  let inRange = true;
  if (shortestDistance <= maxDistance) {
    message = captureLocation(group, nearestLocation);
  } else {
    message = `Du bist nicht in der Nähe einer Position!`;
    inRange = false;
  }

  res.status(200).json({
    message: message,
    inRange: inRange,

  });
});

function readFileAsync(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function initializeData() {
  try {
    const groupsData = await readFileAsync("groups.json");
    groups = JSON.parse(groupsData);

    const locationsData = await readFileAsync("locations.json");
    locations = JSON.parse(locationsData);
    initializeLocations();
  } catch (err) {
    console.error(err);
  }
}

function initializeLocations() {
  const attackTimeStart = Date.now() - attackInterval;
  for (const location of locations) {
    for (const group in groups) {
      location.lastAttack.push({ group: group, time: attackTimeStart });
    }
  }
  isReady = true;
}

function updateVisibleLocations() {
  let currentVisibleLocations = locations.filter((location) => location.visible);
  currentVisibleLocations = JSON.parse(JSON.stringify(currentVisibleLocations));
  currentVisibleLocations.forEach((location) => {
    delete location.lat;
    delete location.lon;
    delete location.lastAttack;
    delete location.visible;
  });
  publicLocations = currentVisibleLocations;
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
  if(group === location.currentOwner) {
    return `Die Position ${location.name} gehört dir bereits.`;
  }
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
    ((attackPossible === true ||
    location.currentOwner === null )&&
    (timeSinceLastAttack > attackInterval))
  ) {
    return isAttackSuccessfull(location);
  } else {
    return false;    
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
    return `Du hast die Position ${location.name} nicht übernommen, die Position ist bereits von ${location.currentOwner} besetzt ist und momentan noch nicht übernommen werden kann.`;
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
}

function mapVisibleLocations(group) {
  if (group === "Admin") {
    return locations.filter((location) => location.visible);
  } else {
    return locations.filter((location) => location.currentOwner === group);
  }
}

function changeLocationOwner(group, location, timeSinceLastAttack) {
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
  updateVisibleLocations();
  return `Gratuliere deine Gruppe (${group}) hat die Position ${
    location.name
  } übernommen! Du hattest eine Chance von ${probability * 100}%`;
}

function startGame() {
  timer.start({countdown: true, startValues : {seconds: 600}});
}

function getRessources() {
  console.log("Ressourcen werden verteilt.");

}

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = {app, server};