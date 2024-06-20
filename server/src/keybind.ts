import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import { useKeybinder } from '@Server/systems/serverKeybinds.js';

const FuelAPI = await useApi().getAsync('ascended-fuel-api');
const HUDAPI = await useApi().getAsync('ascended-hud-api');

useKeybinder().on(88, (player: alt.Player) => {
    FuelAPI.toggleVehicleEngine(player);
});

useKeybinder().on(66, (player: alt.Player) => {
    HUDAPI.seatbelt(player);
});
