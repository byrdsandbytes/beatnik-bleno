# Beatnik Bleno Repo Context & Architecture

This file provides essential context for AI agents working within this repository to understand its purpose, layout, and established coding patterns.

## 🎯 Purpose
This repository contains `beatnik-bleno`, a Bluetooth Low Energy (BLE) WiFi provisioning service. It is designed to run on Linux devices (primarily Raspberry Pi) to allow users to securely configure WiFi credentials via an external BLE client (like a smartphone app).

## 🛠 Core Technologies
- **Node.js**: Targets Node.js v22.
- **TypeScript**: The entire source code is written in TS.
- **Bleno (`@abandonware/bleno`)**: Used for implementing the BLE peripheral service and characteristics.
- **Tsyringe**: Provides Dependency Injection (DI) to construct services.

## 🏛 Architecture Patterns
The project strict follow **Angular-style architecture patterns**, utilizing Dependency Injection, decorators, and a service-oriented design.

### Dependency Injection
- Always use `tsyringe` for DI.
- Services and characteristic classes must be annotated with `@injectable()`.
- Use `@inject('TokenName')` in constructors when resolving dependencies (e.g., `@inject('WiFiManagerService') private wifiManager: WiFiManagerService`).
- Dependencies are manually registered during the application bootstrap phase.

### Bootstrapping
- `src/main.ts` acts as the entry point (similar to Angular's `main.ts`).
- It configures the DI container and initializes the BLE peripheral.

### 📁 Directory Structure
- `src/main.ts`: Application bootstrap and DI container registration.
- `src/config/`: App configuration (e.g., BLE service/characteristic UUIDs, interface names).
- `src/characteristics/`: Contains BLE characteristic implementations (SSID, Password, Connect, Status). These extend a common base characteristic class.
- `src/models/`: TypeScript interfaces, types, and enums (e.g., `WiFiCredentials`, `WiFiStatus`).
- `src/services/`: Core logic managers (e.g., `wifi-manager.service.ts` for managing Linux network states, `gpio.service.ts` for hardware IO).

## 🚦 BLE Workflow
1. Client connects via BLE and discovers the service UUID.
2. Client writes to the **SSID** and **Password** characteristics.
3. Client writes to the **Connect** characteristic to initiate a connection routine.
4. The service reads these credentials, delegates to `WiFiManagerService` to attempt connection (using `nmcli` or `wpa_supplicant` on Linux).
5. The device emits connection updates through the **Status** characteristic (via notifications).

## 📝 Rules for Agents
- **Maintain DI:** When adding new functionality, always wrap it in an `@injectable()` service and register it in `main.ts`.
- **Platform awareness:** WiFi logic is primarily optimized for Linux (Raspberry Pi). Graceful fallbacks exist for macOS (for development testing only).
- **TypeScript Strictness:** Maintain strict typing. Avoid `any` where possible.
- **Characteristics:** If asked to add a new BLE feature, typically it means creating a new file in `src/characteristics`, extending `BaseCharacteristic`, injecting necessary services, and registering it in `main.ts`.
