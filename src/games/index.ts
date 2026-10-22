import { createRegistry } from '../carnival';
import { candyFloss } from './candy-floss/game';
import { waterCannon } from './water-cannon/game';
import { whackAMole } from './whack-a-mole/game';

/** Every game on the midway. A new game is added to this list. */
export const registry = createRegistry([waterCannon, candyFloss, whackAMole]);
