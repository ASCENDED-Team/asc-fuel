import * as alt from 'alt-server';
import {
    getVehicleFuel,
    getVehicleMaxFuel,
    setVehicleConsumptionRates,
    setVehicleFuelTypes,
    startTracking,
    updateFuelConsumption,
} from './src/functions.js';
import { useApi } from '@Server/api/index.js';

import './src/api.js';
import { FUEL_SETTINGS } from './src/config.js';

alt.on('playerEnteredVehicle', (player: alt.Player) => {
    startTracking(player);
});

alt.setInterval(() => {
    alt.Player.all.forEach(async (player) => {
        if (player.vehicle) {
            updateFuelConsumption(player);
            if (FUEL_SETTINGS.AscHUD) {
                const HudAPI = await useApi().getAsync('ascended-hud-api');
                const fuelCalc =
                    ((await getVehicleFuel(player.vehicle.model)) / (await getVehicleMaxFuel(player.vehicle.model))) *
                    100;
                HudAPI.pushFuel(player, fuelCalc);
            }
        }
    });
}, 1000);

if (FUEL_SETTINGS.Debug) {
    setVehicleFuelTypes();
    setVehicleConsumptionRates();
}
