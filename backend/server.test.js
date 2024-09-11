const request = require("supertest");
const express = require("express");
const session = require("express-session");
const { app, server } = require("./server");

describe("Catan Backend API", () => {
    let agent, agent2, agent3;
    const correctLocation = { lat: 47.346416, lon: 9.525444 };
    const incorrectLocation = { lat: 40.7128, lon: -74.0060 };

    beforeEach(() => {
        agent = request.agent(app);
        agent2 = request.agent(app);
    });

    afterAll((done) => {
        server.close(done);
    });

    async function loginAgents() {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            await agent2.post("/login").send({
                group: "Blue Team",
                password: "blue123",
            });

            agent3 = request.agent(app);
            await agent3.post("/login").send({
                group: "Admin",
                password: "admin123",
            });
    }

    // Helper function to reset the server state
    async function resetServerState() {
        await agent.post("/login").send({
            group: "Admin",
            password: "admin123",
        });
        await agent.post("/reset");
        await agent.get("/logout");
    }

    beforeEach(async () => {
        await resetServerState();
    });

    describe("GET /groups", () => {
        it("should return a list of groups", async () => {
            const res = await agent.get("/groups");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual([
                "Red Team",
                "Blue Team",
                "Green Team",
                "Orange Team",
                "Purple Team",
                "Yellow Team",
                "Admin",
            ]);
        });
    });

    describe("POST /login", () => {
        it("should login as a group", async () => {
            const res = await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Logged in successfully",
            });
        });

        it("should fail to login with invalid credentials", async () => {
            const res = await agent.post("/login").send({
                group: "Red Team",
                password: "wrongpassword",
            });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual({
                success: false,
                message: "Invalid credentials",
            });
        });
    });

    describe("Admin operations", () => {
        beforeEach(async () => {
            await agent.post("/login").send({
                group: "Admin",
                password: "admin123",
            });
        });

        it("should reset the game if logged in as Admin", async () => {
            const res = await agent.post("/reset");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Game reset successfully",
            });
        });

        it("should reveal locations if logged in as Admin", async () => {
            const res = await agent.post("/reveal");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Location reveal successfully",
            });
        });

        it("should activate attack mode if logged in as Admin", async () => {
            const res = await agent.post("/attack");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Attack mode activated",
            });
        });
    });

    describe("Non-admin operations", () => {
        beforeEach(async () => {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });
        });

        it("should deny reset if not logged in as Admin", async () => {
            const res = await agent.post("/reset");
            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: "Access denied",
            });
        });

        it("should deny reveal if not logged in as Admin", async () => {
            const res = await agent.post("/reveal");
            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: "Access denied",
            });
        });

        it("should return location status if logged in", async () => {
            const res = await agent.get("/api/location-status");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toBeInstanceOf(Array);
        });
    });

    describe("Unauthenticated operations", () => {
        it("should deny access if not logged in", async () => {
            const res = await agent.get("/api/location-status");
            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: "Access denied",
            });
        });
    });

    describe("POST /api/check-location", () => {
        beforeEach(async () => {
            await resetServerState();
            console.log("reset check-location");
        });

        it("should login a user and send a location that is correct. The answer should be positive.", async () => {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            const res = await agent.post("/api/check-location").send(correctLocation);
            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toEqual("Gratuliere deine Gruppe (Red Team) hat die Position Kirche Eichberg übernommen! Du hattest eine Chance von 95%");
        });

        it("creates a second user. logs both users in and when the second user tries to check the location, he should not get it.", async() =>{
            await loginAgents();
            await agent.post("/api/check-location").send(correctLocation);

            const res = await agent2.post("/api/check-location").send(correctLocation);

            expect(res.body.message).toMatch("nicht übernommen");

        

        });

        it("should login two users activate attack mode and send a correct location. The answer should be negative.", async() =>{
            await loginAgents();

            await agent.post("/api/check-location").send(correctLocation);

            await agent3.post("/attack");

            await agent2.post("/api/check-location").send(correctLocation);

            await new Promise(resolve => setTimeout(resolve, 2000));

            const res = await agent.post("/api/check-location").send(correctLocation);
            console.log(res.body.message);
            expect(res.body.message).toMatch("nicht übernommen");
            expect(res.body.message).toMatch("58");

        });

        it("should login 1 user and try to retake a location already taken by the same user. The answer should be negative.", async() =>{
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            await agent.post("/api/check-location").send(correctLocation);

            const res = await agent.post("/api/check-location").send(correctLocation);
            expect(res.body.message).toMatch("gehört dir bereits");
        });
    });
});
