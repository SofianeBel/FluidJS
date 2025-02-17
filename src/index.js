import { FluidScene } from './scenes/FluidScene';

// Création de la scène
const fluidScene = new FluidScene();

// Démarrage de la simulation
fluidScene.start();

// Application des optimisations
fluidScene.optimizeMemoryUsage();
fluidScene.optimizeRendering();

// Gestion du redimensionnement de la fenêtre
window.addEventListener('resize', () => {
    fluidScene.onWindowResize();
}); 