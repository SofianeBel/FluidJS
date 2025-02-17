export class StableFluidsSolver {
    constructor(width, height, viscosity = 0.0001, dt = 0.016) {
        this.width = width;
        this.height = height;
        this.viscosity = viscosity;
        this.dt = dt;

        // Grilles pour la vélocité et la densité
        this.u = new Float32Array(width * height); // Vélocité X
        this.v = new Float32Array(width * height); // Vélocité Y
        this.u_prev = new Float32Array(width * height);
        this.v_prev = new Float32Array(width * height);
        this.density = new Float32Array(width * height);
        this.density_prev = new Float32Array(width * height);
    }

    step() {
        // Sauvegarde des états précédents
        this.u_prev.set(this.u);
        this.v_prev.set(this.v);
        this.density_prev.set(this.density);

        // Étapes de la simulation
        this.diffuse(this.u, this.u_prev, this.viscosity);
        this.diffuse(this.v, this.v_prev, this.viscosity);
        
        this.project();
        
        this.advect(this.u);
        this.advect(this.v);
        
        this.project();

        // Diffusion de la densité
        this.diffuse(this.density, this.density_prev, 0.0001);
        this.advectDensity();
    }

    diffuse(x, x0, diffusion) {
        const a = this.dt * diffusion * this.width * this.height;
        this.linearSolve(x, x0, a, 1 + 4 * a);
    }

    linearSolve(x, x0, a, c) {
        const iter = 4; // Nombre d'itérations pour la convergence
        for (let k = 0; k < iter; k++) {
            for (let i = 1; i < this.width - 1; i++) {
                for (let j = 1; j < this.height - 1; j++) {
                    const idx = i + j * this.width;
                    x[idx] = (x0[idx] + a * (
                        x[idx - 1] + x[idx + 1] +
                        x[idx - this.width] + x[idx + this.width]
                    )) / c;
                }
            }
            this.setBoundary(x);
        }
    }

    project() {
        const div = new Float32Array(this.width * this.height);
        const p = new Float32Array(this.width * this.height);

        // Calcul de la divergence
        for (let i = 1; i < this.width - 1; i++) {
            for (let j = 1; j < this.height - 1; j++) {
                const idx = i + j * this.width;
                div[idx] = -0.5 * (
                    this.u[idx + 1] - this.u[idx - 1] +
                    this.v[idx + this.width] - this.v[idx - this.width]
                ) / this.width;
                p[idx] = 0;
            }
        }

        this.setBoundary(div);
        this.setBoundary(p);
        this.linearSolve(p, div, 1, 4);

        // Soustraction du gradient de pression
        for (let i = 1; i < this.width - 1; i++) {
            for (let j = 1; j < this.height - 1; j++) {
                const idx = i + j * this.width;
                this.u[idx] -= 0.5 * (p[idx + 1] - p[idx - 1]) * this.width;
                this.v[idx] -= 0.5 * (p[idx + this.width] - p[idx - this.width]) * this.width;
            }
        }

        this.setBoundary(this.u);
        this.setBoundary(this.v);
    }

    advect(d) {
        const d0 = new Float32Array(d);
        const dt0 = this.dt * this.width;

        for (let i = 1; i < this.width - 1; i++) {
            for (let j = 1; j < this.height - 1; j++) {
                const idx = i + j * this.width;
                
                let x = i - dt0 * this.u[idx];
                let y = j - dt0 * this.v[idx];
                
                x = Math.max(0.5, Math.min(this.width - 1.5, x));
                y = Math.max(0.5, Math.min(this.height - 1.5, y));
                
                const i0 = Math.floor(x);
                const i1 = i0 + 1;
                const j0 = Math.floor(y);
                const j1 = j0 + 1;
                
                const s1 = x - i0;
                const s0 = 1 - s1;
                const t1 = y - j0;
                const t0 = 1 - t1;
                
                d[idx] = s0 * (t0 * d0[i0 + j0 * this.width] + t1 * d0[i0 + j1 * this.width]) +
                         s1 * (t0 * d0[i1 + j0 * this.width] + t1 * d0[i1 + j1 * this.width]);
            }
        }
        
        this.setBoundary(d);
    }

    advectDensity() {
        const d0 = new Float32Array(this.density);
        const dt0 = this.dt * this.width;

        for (let i = 1; i < this.width - 1; i++) {
            for (let j = 1; j < this.height - 1; j++) {
                const idx = i + j * this.width;
                
                let x = i - dt0 * this.u[idx];
                let y = j - dt0 * this.v[idx];
                
                x = Math.max(0.5, Math.min(this.width - 1.5, x));
                y = Math.max(0.5, Math.min(this.height - 1.5, y));
                
                const i0 = Math.floor(x);
                const i1 = i0 + 1;
                const j0 = Math.floor(y);
                const j1 = j0 + 1;
                
                const s1 = x - i0;
                const s0 = 1 - s1;
                const t1 = y - j0;
                const t0 = 1 - t1;
                
                this.density[idx] = s0 * (t0 * d0[i0 + j0 * this.width] + t1 * d0[i0 + j1 * this.width]) +
                                  s1 * (t0 * d0[i1 + j0 * this.width] + t1 * d0[i1 + j1 * this.width]);
            }
        }
        
        this.setBoundary(this.density);
    }

    setBoundary(x) {
        // Conditions aux limites
        for (let i = 1; i < this.width - 1; i++) {
            x[i] = x[i + this.width];
            x[i + (this.height - 1) * this.width] = x[i + (this.height - 2) * this.width];
        }
        for (let j = 1; j < this.height - 1; j++) {
            x[j * this.width] = x[1 + j * this.width];
            x[this.width - 1 + j * this.width] = x[this.width - 2 + j * this.width];
        }
        
        // Coins
        x[0] = 0.5 * (x[1] + x[this.width]);
        x[this.width - 1] = 0.5 * (x[this.width - 2] + x[2 * this.width - 1]);
        x[(this.height - 1) * this.width] = 0.5 * (x[1 + (this.height - 2) * this.width] + x[(this.height - 1) * this.width + 1]);
        x[this.width * this.height - 1] = 0.5 * (x[this.width * this.height - 2] + x[(this.height - 1) * this.width - 1]);
    }

    addForce(x, y, amountX, amountY, radius = 2.0) {
        const idx = Math.floor(x) + Math.floor(y) * this.width;
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const currentIdx = idx + i + j * this.width;
                if (currentIdx >= 0 && currentIdx < this.u.length) {
                    const distance = Math.sqrt(i * i + j * j);
                    const influence = Math.max(0, 1 - distance / radius);
                    this.u[currentIdx] += amountX * influence;
                    this.v[currentIdx] += amountY * influence;
                }
            }
        }
    }

    addDensity(x, y, amount, radius = 2.0) {
        const idx = Math.floor(x) + Math.floor(y) * this.width;
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const currentIdx = idx + i + j * this.width;
                if (currentIdx >= 0 && currentIdx < this.density.length) {
                    const distance = Math.sqrt(i * i + j * j);
                    const influence = Math.max(0, 1 - distance / radius);
                    this.density[currentIdx] += amount * influence;
                }
            }
        }
    }
} 