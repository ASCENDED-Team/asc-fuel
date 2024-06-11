import * as alt from 'alt-server';
import { setVehicleConsumptionRates, setVehicleFuelTypes, startTracking, updateFuelConsumption } from './src/functions.js';

alt.on('playerEnteredVehicle', (player: alt.Player) => {
    startTracking(player);
});

alt.setInterval(() => {
    alt.Player.all.forEach(player => {
        if (player.vehicle) {
            updateFuelConsumption(player);
        }
    });
}, 5000);

setVehicleFuelTypes();
setVehicleConsumptionRates();