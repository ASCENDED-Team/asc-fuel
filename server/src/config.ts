import * as alt from 'alt-server';
import { FUEL_TYPES } from "./fuelTypes.js";

export const Default_Consumption = 0.05;
export const Default_Fuel = FUEL_TYPES.Diesel;

export const VEHICLE_CONSUMPTION: Array<{ model: number, consume: number, maxFuel: number }> = [
    { model: alt.hash('t20'), consume: 0.09, maxFuel: 40  },
    { model: alt.hash('zentorno'), consume: 0.1, maxFuel: 30 },
    { model: alt.hash('panto'), consume: 0.05, maxFuel: 15 },
    { model: alt.hash('italirsx'), consume: 0.002, maxFuel: 30 }
]

export const GASOLIN = ['sultanrs', 't20', 'krieger'];

export const KEROSIN = ['maverick'];

export const DIESEL = ['panto'];

export const ELECTRIC = ['italirsx'];