import { useRebar } from '@Server/index.js';
import * as alt from 'alt-server';

const Rebar = useRebar();
const ServerConfig = Rebar.useServerConfig();

ServerConfig.set('disableVehicleEngineAutoStart', true); // Disables Engine Auto Start

export const FUEL_TYPES = {
    Gasolin: { name: 'Gasolin', price: 2.5 },
    Diesel: { name: 'Diesel', price: 2.8 },
    Electric: { name: 'Electric', price: 0.15 },
    Kerosin: { name: 'Kerosin', price: 3.2 },
};

export const FUEL_SETTINGS = {
    checkForUpdates: true,
    AscHUD: true,
    AscNotification: true,
    Debug: true,
    DefaultConsumption: 0.003,
    DefaultFuel: FUEL_TYPES.Diesel.name,
    DefaultMax: 30,
    enableSound: false,
};

export const VEHICLE_CONSUMPTION: Array<{ model: number; consume: number; type?: string; maxFuel: number }> = [
    { model: alt.hash('t20'), consume: 0.009, type: FUEL_TYPES.Diesel.name, maxFuel: 40 },
    { model: alt.hash('zentorno'), consume: 0.0035, type: FUEL_TYPES.Gasolin.name, maxFuel: 30 },
    { model: alt.hash('panto'), consume: 0.05, maxFuel: 15 },
    { model: alt.hash('italirsx'), consume: 0.1, maxFuel: 30 },
    { model: alt.hash('krieger'), consume: 0.01, maxFuel: 50 },
];
