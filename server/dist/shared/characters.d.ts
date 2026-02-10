/**
 * Character archetypes and combat constants
 * Defines stats for faran, baran (guardians), and paran (force)
 */
export interface CharacterStats {
    maxHealth: number;
    acceleration: number;
    maxVelocity: number;
    drag: number;
    damage: number;
    fireRate: number;
    projectileSpeed: number;
}
export declare const CHARACTERS: Record<string, CharacterStats>;
export declare const COMBAT: {
    playerRadius: number;
    projectileRadius: number;
    projectileLifetime: number;
};
