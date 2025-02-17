export const FluidVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const FluidFragmentShader = `
    uniform sampler2D tDensity;
    uniform sampler2D tVelocity;
    uniform float time;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    // Fonction pour créer des variations aléatoires
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    // Bruit de Perlin simplifié
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }

    // Fonction pour créer un dégradé de couleurs basé sur la densité
    vec3 getFluidColor(float density, float speed) {
        vec3 lowColor = vec3(0.1, 0.2, 0.3);  // Bleu foncé
        vec3 midColor = vec3(0.2, 0.5, 0.7);  // Bleu clair
        vec3 highColor = vec3(0.8, 0.9, 1.0); // Blanc bleuté
        
        float t = density * (1.0 + speed);
        vec3 color = mix(lowColor, midColor, smoothstep(0.0, 0.5, t));
        color = mix(color, highColor, smoothstep(0.5, 1.0, t));
        
        return color;
    }
    
    void main() {
        // Échantillonnage des textures
        vec4 density = texture2D(tDensity, vUv);
        vec2 velocity = texture2D(tVelocity, vUv).xy;
        
        // Calcul de l'intensité du fluide
        float intensity = density.r;
        
        // Ajout de variations temporelles
        float noiseValue = noise(vUv * 8.0 + time * 0.1);
        intensity *= 1.0 + 0.3 * noiseValue;
        
        // Calcul de la vitesse pour les effets de mouvement
        float speed = length(velocity);
        
        // Obtention de la couleur du fluide
        vec3 fluidColor = getFluidColor(intensity, speed);
        
        // Effet de profondeur et de volume
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
        fluidColor = mix(fluidColor, vec3(1.0), fresnel * 0.3);
        
        // Ajout d'un effet de brillance basé sur la vitesse
        float speedGlow = smoothstep(0.0, 2.0, speed);
        fluidColor += vec3(0.2, 0.4, 0.6) * speedGlow;
        
        // Calcul de l'alpha avec un seuil minimum pour éviter la transparence totale
        float alpha = smoothstep(0.1, 0.3, intensity);
        alpha = max(0.1, alpha); // Garde une légère visibilité même à faible densité
        
        gl_FragColor = vec4(fluidColor, alpha);
    }
`; 