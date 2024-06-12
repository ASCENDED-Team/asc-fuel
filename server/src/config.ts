import * as alt from 'alt-server';
import { FUEL_TYPES } from "./fuelTypes.js";

export const FUEL_SETTINGS = {
    DefaultConsumption: 0.003,
    DefaultFuel: FUEL_TYPES.Diesel,
}

export const VEHICLE_CONSUMPTION: Array<{ model: number, consume: number, maxFuel: number }> = [
    { model: alt.hash('t20'), consume: 0.009, maxFuel: 40  },
    { model: alt.hash('zentorno'), consume: 0.1, maxFuel: 30 },
    { model: alt.hash('panto'), consume: 0.05, maxFuel: 15 },
    { model: alt.hash('italirsx'), consume: 0.002, maxFuel: 30 },
    { model: alt.hash('krieger'), consume: 0.01, maxFuel: 50 }
]

export const GASOLIN = ['sultanrs', 't20', 'krieger'];

export const KEROSIN = ['maverick'];

export const DIESEL = ['panto'];

export const ELECTRIC = ['italirsx'];