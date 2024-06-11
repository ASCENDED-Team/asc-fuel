import * as alt from 'alt-server';
import { FUEL_TYPES } from "./fuelTypes.js";

export const Default_Consumption = 0.05;
export const Default_Fuel = FUEL_TYPES.Diesel;

export const VEHICLE_CONSUMPTION = [
    { model: alt.hash('t20'), consume: 1 },
    { model: alt.hash('zentorno'), consume: 0.15 },
    { model: alt.hash('panto'), consume: 0.05 },
]


export const GASOLIN = ['sultanrs', 't20', 'krieger'];

export const KEROSIN = ['maverick'];