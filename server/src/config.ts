import { NETWORK } from '../../shared/physics';

export const SERVER_CONFIG = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 2567,
  tickRate: NETWORK.tickRate,
  fixedTimeStep: NETWORK.fixedTimeStep,
  patchRate: NETWORK.fixedTimeStep, // must match tick rate for smooth 60Hz sync
};

export const GAME_CONFIG = {
  maxPlayers: 3, // 1v2 asymmetric game
  playerStartHealth: 100,
};
