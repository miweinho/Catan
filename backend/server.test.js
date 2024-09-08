const request = require("supertest");
const express = require("express");
const session = require("express-session");
const {app, server} = require("./server");





describe("Catan Backend API", () => {
    let agent;

    beforeAll(() => {
        agent = request.agent(app);
    });

    afterAll((done) => {
        server.close(done);
    })

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

    describe("POST /reset", () => {
        it("should reset the game if logged in as Admin", async () => {
            await agent.post("/login").send({
                group: "Admin",
                password: "admin123",
            });

            const res = await agent.post("/reset");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Game reset successfully",
            });
        });

        it("should deny reset if not logged in as Admin", async () => {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            const res = await agent.post("/reset");
            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: "Access denied",
            });
        });
    });

    describe("POST /reveal", () => {
        it("should reveal locations if logged in as Admin", async () => {
            await agent.post("/login").send({
                group: "Admin",
                password: "admin123",
            });

            const res = await agent.post("/reveal");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Location reveal successfully",
            });
        });

        it("should deny reveal if not logged in as Admin", async () => {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            const res = await agent.post("/reveal");
            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: "Access denied",
            });
        });
    });

    describe("POST /attack", () => {
        it("should activate attack mode if logged in as Admin", async () => {
            await agent.post("/login").send({
                group: "Admin",
                password: "admin123",
            });

            const res = await agent.post("/attack");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                success: true,
                message: "Attack mode activated",
            });
        });
    });

    describe("GET /api/location-status", () => {
        it("should return location status if logged in", async () => {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            const res = await agent.get("/api/location-status");
            expect(res.statusCode).toEqual(200);
            expect(res.body).toBeInstanceOf(Array);
        });

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
        it("should check location and return appropriate message", async () => {
            await agent.post("/login").send({
                group: "Red Team",
                password: "red123",
            });

            const res = await agent.post("/api/check-location").send({
                lat: 47.346416,
                lon: 9.525444,
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty("message");
            expect(res.body).toHaveProperty("location");
        });

        it("should deny access if not logged in", async () => {
            const res = await agent.post("/api/check-location").send({
                lat: 47.346416,
                lon: 9.525444,
            });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toEqual({
                success: false,
                message: "Not logged in",
            });
        });
    });
});
