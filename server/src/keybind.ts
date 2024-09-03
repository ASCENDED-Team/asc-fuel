import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import { useKeybinder } from '@Server/systems/serverKeybinds.js';
import { FUEL_SETTINGS } from './config.js';

const FuelAPI = await useApi().getAsync('ascended-fuel-api');

useKeybinder().on(88, (player: alt.Player) => {
    FuelAPI.vehicle.toggleEngine(player);
});

useKeybinder().on(66, async (player: alt.Player) => {
    if (FUEL_SETTINGS.AscHUD) {
        const HUDAPI = await useApi().getAsync('ascended-hud-api');
        HUDAPI.seatbelt(player);
    }
});
