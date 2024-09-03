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
    ASCHUDPro: false,
    AscNotification: true,
    Debug: true,
    DefaultConsumption: 0.003,
    DefaultFuel: FUEL_TYPES.Diesel.name,
    DefaultMax: 30,
    enableSound: false,
};

const DEFAULT_VEHICLE_CONFIG = {
    consume: FUEL_SETTINGS.DefaultConsumption,
    type: FUEL_SETTINGS.DefaultFuel,
    maxFuel: FUEL_SETTINGS.DefaultMax,
};

export const VEHICLE_CONSUMPTION = {
    [alt.hash('t20')]: { consume: 0.009, type: FUEL_TYPES.Diesel.name, maxFuel: 40 },
    [alt.hash('zentorno')]: { consume: 0.0035, type: FUEL_TYPES.Gasolin.name, maxFuel: 30 },
    [alt.hash('panto')]: { consume: 0.05, maxFuel: 15 },
    [alt.hash('italirsx')]: { consume: 0.1, maxFuel: 30 },
    [alt.hash('krieger')]: { consume: 0.01, maxFuel: 50 },
};

export function getVehicleConsumption(model: number) {
    return VEHICLE_CONSUMPTION[model] || DEFAULT_VEHICLE_CONFIG;
}

// * If you know what you're doing feel free to use it. * //
// export function addVehicleConsumption(modelName: string, config: Partial<typeof DEFAULT_VEHICLE_CONFIG>) {
//     const modelHash = alt.hash(modelName);
//     VEHICLE_CONSUMPTION[modelHash] = { ...DEFAULT_VEHICLE_CONFIG, ...config };
// }
