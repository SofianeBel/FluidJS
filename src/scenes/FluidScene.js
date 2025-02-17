import * as THREE from 'three';
import { Engine } from '../core/Engine';
import { StableFluidsSolver } from '../physics/StableFluidsSolver';
import { FluidVertexShader, FluidFragmentShader } from '../shaders/FluidShader';

export class FluidScene extends Engine {
    constructor() {
        super();
        
        // Configuration de la simulation
        this.simWidth = 256;
        this.simHeight = 256;
        
        // Initialisation du solveur de fluides
        this.fluidSolver = new StableFluidsSolver(this.simWidth, this.simHeight);
        
        // Création des textures pour la densité et la vélocité
        this.densityTexture = new THREE.DataTexture(
            this.fluidSolver.density,
            this.simWidth,
            this.simHeight,
            THREE.RedFormat,
            THREE.FloatType
        );
        
        this.velocityTexture = new THREE.DataTexture(
            new Float32Array(this.simWidth * this.simHeight * 2),
            this.simWidth,
            this.simHeight,
            THREE.RGFormat,
            THREE.FloatType
        );
        
        this.setupScene();
        this.setupEventListeners();
    }
    
    setupScene() {
        // Création de plusieurs plans de fluide à différentes hauteurs
        const createFluidPlane = (y, scale = 1.0) => {
            const geometry = new THREE.PlaneGeometry(10 * scale, 10 * scale, 128, 128);
            geometry.rotateX(-Math.PI / 2); // Rotation pour l'horizontalité
            
            const material = new THREE.ShaderMaterial({
                vertexShader: FluidVertexShader,
                fragmentShader: FluidFragmentShader,
                transparent: true,
                side: THREE.DoubleSide,
                uniforms: {
                    tDensity: { value: this.densityTexture },
                    tVelocity: { value: this.velocityTexture },
                    time: { value: 0 }
                }
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = y;
            this.scene.add(mesh);
            return mesh;
        };

        // Création de plusieurs couches de fluide
        this.fluidLayers = [
            createFluidPlane(0, 1.0),    // Couche principale
            createFluidPlane(0.5, 0.95),  // Couche légèrement au-dessus
            createFluidPlane(1.0, 0.9)    // Couche supérieure
        ];

        // Ajout d'un conteneur pour le fluide (cube transparent)
        const boxGeometry = new THREE.BoxGeometry(10, 2, 10);
        const boxMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x444444,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.y = 1;
        this.scene.add(box);

        // Ajout de réflecteurs
        const reflectorGeometry = new THREE.PlaneGeometry(20, 20);
        const reflectorMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1
        });

        // Sol réfléchissant
        const floor = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
        floor.rotateX(-Math.PI / 2);
        floor.position.y = -0.01;
        this.scene.add(floor);
    }
    
    setupEventListeners() {
        let isMouseDown = false;
        let lastX = 0;
        let lastY = 0;
        
        const getSimCoords = (event) => {
            // Conversion des coordonnées de la souris en coordonnées de simulation
            const rect = this.renderer.domElement.getBoundingClientRect();
            
            // Calcul du vecteur de la souris en coordonnées normalisées (-1 à 1)
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            // Création du rayon
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);

            // Intersection avec le plan principal
            const intersects = raycaster.intersectObject(this.fluidLayers[0]);
            
            if (intersects.length > 0) {
                const point = intersects[0].point;
                // Conversion des coordonnées 3D en coordonnées de simulation
                const x = ((point.x + 5) / 10) * this.simWidth;
                const y = ((point.z + 5) / 10) * this.simHeight;
                return { x, y };
            }
            
            return null;
        };
        
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            const coords = getSimCoords(event);
            if (coords) {
                isMouseDown = true;
                lastX = coords.x;
                lastY = coords.y;
            }
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const coords = getSimCoords(event);
            if (!coords) return;

            const dx = coords.x - lastX;
            const dy = coords.y - lastY;
            
            // Ajout de forces et de densité
            this.fluidSolver.addForce(coords.x, coords.y, dx * 0.1, dy * 0.1, 4.0);
            this.fluidSolver.addDensity(coords.x, coords.y, 1.0, 4.0);
            
            lastX = coords.x;
            lastY = coords.y;
        });
    }
    
    update(deltaTime) {
        super.update(deltaTime);

        // Mise à jour de la simulation
        this.fluidSolver.step();
        
        // Mise à jour des textures
        this.densityTexture.needsUpdate = true;
        
        // Mise à jour de la texture de vélocité
        if (!this._velocityData) {
            this._velocityData = new Float32Array(this.simWidth * this.simHeight * 2);
        }
        
        for (let i = 0; i < this.simWidth * this.simHeight; i++) {
            this._velocityData[i * 2] = this.fluidSolver.u[i];
            this._velocityData[i * 2 + 1] = this.fluidSolver.v[i];
        }
        this.velocityTexture.image.data = this._velocityData;
        this.velocityTexture.needsUpdate = true;
        
        // Mise à jour du temps pour les shaders
        this.fluidLayers.forEach(layer => {
            layer.material.uniforms.time.value += deltaTime;
        });
    }
    
    // Méthodes d'optimisation
    optimizeMemoryUsage() {
        // Réutilisation des tableaux Float32Array pour éviter la création d'objets
        this._velocityData = this._velocityData || new Float32Array(this.simWidth * this.simHeight * 2);
        
        // Utilisation de transferables pour les workers si nécessaire
        if (this.worker) {
            this.worker.postMessage({ 
                velocityData: this._velocityData.buffer 
            }, [this._velocityData.buffer]);
        }
    }
    
    optimizeRendering() {
        // Utilisation de FrustumCulling pour éviter le rendu des objets hors champ
        this.scene.traverse((object) => {
            if (object.isMesh) {
                object.frustumCulled = true;
            }
        });
        
        // Optimisation des matériaux
        this.fluidLayers.forEach(layer => {
            layer.material.precision = 'highp';
            layer.material.premultipliedAlpha = true;
        });
    }
} 