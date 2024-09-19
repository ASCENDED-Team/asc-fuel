import { useRebar } from '@Server/index.js';

const Rebar = useRebar();
const ServerConfig = Rebar.useServerConfig();

ServerConfig.set('disableVehicleEngineAutoStart', true); // Disables Engine Auto Start

export enum FuelType {
    Gasoline = 'Gasoline',
    Diesel = 'Diesel',
    Electric = 'Electric',
    Kerosene = 'Kerosene',
}

class FuelProperties {
    constructor(public name: FuelType) {}
}

export const FUEL_TYPES = new Map<FuelType, FuelProperties>([
    [FuelType.Gasoline, new FuelProperties(FuelType.Gasoline)],
    [FuelType.Diesel, new FuelProperties(FuelType.Diesel)],
    [FuelType.Electric, new FuelProperties(FuelType.Electric)],
    [FuelType.Kerosene, new FuelProperties(FuelType.Kerosene)],
]);

export class FuelSettings {
    checkForUpdates = true;
    AscHUD = true;
    ASCHUDPro = false;
    AscNotification = true;
    Debug = true;
    DefaultConsumption = 0.002;
    DefaultFuel: FuelType = FuelType.Diesel;
    DefaultMax = 60;
    enableSound = false;
}

export const FUEL_SETTINGS = new FuelSettings();

class VehicleConsumptionConfig {
    constructor(
        public consume: number,
        public type: FuelType,
        public maxFuel: number,
    ) {}
}

export const VEHICLE_FUEL_CONFIG: { [modelName: string]: VehicleConsumptionConfig } = {
    adder: new VehicleConsumptionConfig(0.006, FuelType.Gasoline, 55),
    sultanrs: new VehicleConsumptionConfig(0.004, FuelType.Gasoline, 60),
    blista: new VehicleConsumptionConfig(0.003, FuelType.Gasoline, 40),
    panto: new VehicleConsumptionConfig(0.02, FuelType.Gasoline, 20),
    // ... add more vehicles here ...
};

export function getVehicleConsumption(modelName: string): VehicleConsumptionConfig {
    const lowerCaseModelName = modelName.toLowerCase();

    if (lowerCaseModelName in VEHICLE_FUEL_CONFIG) {
        return VEHICLE_FUEL_CONFIG[lowerCaseModelName];
    }

    return new VehicleConsumptionConfig(
        FUEL_SETTINGS.DefaultConsumption,
        FUEL_SETTINGS.DefaultFuel,
        FUEL_SETTINGS.DefaultMax,
    );
}
