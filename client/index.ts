import * as alt from 'alt-client';

alt.onServer('ResetRPM', () => {
    alt.Player.local.vehicle.rpm = 0;
});
