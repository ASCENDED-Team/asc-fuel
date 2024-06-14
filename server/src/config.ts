import { useRebar } from '@Server/index.js';
import * as alt from 'alt-server';
const Rebar = useRebar();
const ServerConfig = Rebar.useServerConfig();

ServerConfig.set('disableVehicleEngineAutoStart', true); // Disables Engine Auto Start
const FUEL_TYPES = {
    Gasolin: 'Gasolin',
    Diesel: 'Diesel',
    Electric: 'Electric',
    Kerosin: 'Kerosin'
}

export const FUEL_SETTINGS = {
    AscHUD: true,
    Debug: true,
    DefaultConsumption: 0.003,
    DefaultFuel: FUEL_TYPES.Diesel,
    DefaultMax: 30,
    enableSound: false,
}

export const VEHICLE_CONSUMPTION: Array<{ model: number, consume: number, type?: string, maxFuel: number }> = [
    { model: alt.hash('t20'), consume: 0.009, type: FUEL_TYPES.Diesel, maxFuel: 40  },
    { model: alt.hash('zentorno'), consume: 0.0012, type: FUEL_TYPES.Gasolin, maxFuel: 30 },
    { model: alt.hash('panto'), consume: 0.05, maxFuel: 15 },
    { model: alt.hash('italirsx'), consume: 0.002, maxFuel: 30 },
    { model: alt.hash('krieger'), consume: 0.01, maxFuel: 50 }
]