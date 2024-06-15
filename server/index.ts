import * as alt from 'alt-server';
import {
    getVehicleFuel,
    getVehicleMaxFuel,
    setVehicleConsumptionRates,
    startTracking,
    updateFuelConsumption,
} from './src/functions.js';
import './src/api.js';
import './src/keybind.js';

import { FUEL_SETTINGS } from './src/config.js';
import { useApi } from '@Server/api/index.js';

const HudAPI = await useApi().getAsync('ascended-hud-api');

alt.on('playerEnteredVehicle', async (player: alt.Player) => {
    startTracking(player);
    await updateVehicleFuelData(player);
});

const getFuelData = async (vehicle: alt.Vehicle) => {
    const fuel = await getVehicleFuel(vehicle);
    const maxFuel = await getVehicleMaxFuel(vehicle);
    return (fuel / maxFuel) * 100;
};

async function updateVehicleFuelData(player: alt.Player) {
    if (FUEL_SETTINGS.AscHUD) {
        const fuelCalc = await getFuelData(player.vehicle);
        HudAPI.pushFuel(player, fuelCalc);
    }
}

alt.setInterval(async () => {
    const playersWithVehicles = alt.Player.all.filter((player) => player.vehicle);

    for (const player of playersWithVehicles) {
        if (!player.vehicle.engineOn) return;

        updateFuelConsumption(player);
        await updateVehicleFuelData(player);
    }
}, 1000);

alt.setTimeout(async () => {
    await setVehicleConsumptionRates();
}, 1500);
