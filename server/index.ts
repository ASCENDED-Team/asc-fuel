import * as alt from 'alt-server';
import { getVehicleFuel, getVehicleMaxFuel, setVehicleConsumptionRates, setVehicleFuelTypes, startTracking, updateFuelConsumption } from './src/functions.js';
import { useApi } from '@Server/api/index.js';

const HudAPI = await useApi().getAsync('ascended-hud-api');
import './src/api.js';

alt.on('playerEnteredVehicle', (player: alt.Player) => {
    startTracking(player);
});

alt.setInterval(() => {
    alt.Player.all.forEach(async player => {
        if (player.vehicle) {
            updateFuelConsumption(player);
            HudAPI.pushFuel(player, await getVehicleFuel(player.vehicle.model) / await getVehicleMaxFuel(player.vehicle.model) * 100)
        }
    });
}, 1000);

setVehicleFuelTypes();
setVehicleConsumptionRates();