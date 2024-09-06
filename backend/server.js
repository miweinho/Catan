const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using https
}));

// Define locations with ownership information
let locations = [
    { name: "Kirche Eichberg", lat: 47.346416, lon: 9.525444, currentOwner: null, visible: false },
    { name: "Fussballfeld Lagerhaus", lat: 47.342758, lon: 9.513821, currentOwner: null, visible: false },
    { name: "Sportplatz Dorf", lat: 47.345082, lon: 9.523095, currentOwner: null, visible: false },
    { name: "Reservoir", lat: 47.342513, lon: 9.512209, currentOwner: null, visible: false },
    { name: "Landgasthof Hölzlisberg", lat: 47.345040, lon: 9.513739, currentOwner: null, visible: false },
    { name: "Zoologische Station", lat: 47.347345, lon: 9.525002, currentOwner: null, visible: false },
    { name: "Kartonfabrik", lat: 47.339972, lon: 9.521770, currentOwner: null, visible: false },
    { name: "Heiterhof", lat: 47.344916, lon: 9.525751, currentOwner: null, visible: false },
    { name: "Seeli Ost", lat: 47.345663, lon: 9.535846, currentOwner: null, visible: false },
];

const maxDistance = 50; // Maximum distance in meters

// Define groups and their passwords (in a real app, use a database)
const groups = {
    "Red Team": { password: "red123", capturedLocations: [] },
    "Blue Team": { password: "blue123", capturedLocations: [] },
    "Green Team": { password: "green123", capturedLocations: [] },
    "Orange Team": { password: "orange123", capturedLocations: [] },
    "Purple Team": { password: "purple123", capturedLocations: [] },
    "Yellow Team": { password: "yellow123", capturedLocations: [] }
};

// Status page password (in a real app, use a more secure method)
const statusPagePassword = "admin123";

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/groups', (req, res) => {
    res.json(Object.keys(groups));
});

app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'status.html'));
});

app.post('/reset', (req, res) => {
    locations = locations.map(location => ({ ...location, currentOwner: null }));
    for (const group in groups) {
        groups[group].capturedLocations = 0;
    }
    res.json({ success: true, message: "Game reset successfully" });
});

app.post('/login', async (req, res) => {
    const { group, password } = req.body;
    if (groups[group] && password === groups[group].password) {
        req.session.group = group;
        res.json({ success: true, message: "Logged in successfully" });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: "Logged out successfully" });
});

app.post('/api/check-status-password', (req, res) => {
    if (req.body.password === statusPagePassword) {
        req.session.statusAccess = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Invalid password" });
    }
});

app.get('/api/location-status', (req, res) => {
    if (req.session.statusAccess) {
        res.json(locations.map(({ name, lat, lon, currentOwner }) => ({ name, lat, lon, currentOwner })));
    } else {
        res.status(403).json({ success: false, message: "Access denied" });
    }
});

app.post('/api/check-location', (req, res) => {
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
        if (nearestLocation.currentOwner === group) {
            message = `Your group (${group}) already owns ${nearestLocation.name}!`;
        } else {
            if (nearestLocation.currentOwner) {
                groups[nearestLocation.currentOwner].capturedLocations--;
            }
            nearestLocation.currentOwner = group;
            groups[group].capturedLocations++;
            message = `Congratulations! Your group (${group}) has taken over ${nearestLocation.name}!`;
        }
    } else {
        message = `You are not within range of any known location.`;
    }

    res.json({
        message: message,
        capturedLocations: groups[group].capturedLocations
    });
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});