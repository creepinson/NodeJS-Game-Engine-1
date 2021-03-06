import { Tensor, Vector } from "@throw-out-error/throw-out-utils";
import { World } from "../physics";
import Graphics from "../window/dom/canvas/graphics";

//Returns true if the two circles intersect.
function CvC(pos1: Tensor, r1: number, pos2: Tensor, r2: number): boolean {
    return (r1 + r2) ** 2 > pos1.clone().sub(pos2).magSq();
}

//Return true if the two axis aligned bounding boxes intersect.
function AABBvAABB(
    pos1: Tensor,
    w1: number,
    h1: number,
    pos2: Tensor,
    w2: number,
    h2: number
) {
    return (
        pos1.x - w1 / 2 < pos2.x + w2 / 2 &&
        pos1.x + w1 / 2 > pos2.x - w2 / 2 &&
        pos1.y - h1 / 2 < pos2.y + h2 / 2 &&
        pos1.y + h1 / 2 > pos2.y - h2 / 2
    );
}

interface options {
    isStatic?: boolean;
    mass?: number;
    maxSpeed?: number;
}

export class Body2d {
    id = -1;
    group = "";
    removed = false;
    pos: Tensor = Tensor.from<Vector>(0, 0, 0);
    vel: Tensor = Tensor.from<Vector>(0, 0, 0);
    acc: Tensor = Tensor.from<Vector>(0, 0, 0);
    inverseMass: number;
    isStatic: boolean;
    maxSpeed: number;

    constructor(options: options = {}) {
        this.inverseMass = 1 / (options.mass ?? 1);
        this.isStatic = options.isStatic ?? false;
        this.maxSpeed = options.maxSpeed ?? Infinity;
    }

    isColliding(b: Body2d): boolean {
        // TODO: implement this
        return false;
    }

    repulse(b: Body2d) {
        // TODO: implement this
    }

    accelerate(v: Tensor) {
        this.acc.add(v);
    }

    update(World: World, timeStepLength: number) {
        // Update position and velocity
        if (this.isStatic) return;
        this.vel.add(this.acc.clone().scale(timeStepLength));
        this.acc.set(0, 0);
        if (this.vel.magSq() > this.maxSpeed ** 2)
            this.vel.setMag(this.maxSpeed);
        this.pos.add(this.vel.clone().scale(timeStepLength));
        // Run dev assigned timestep function
        this.timeStep(World);
    }

    kill() {
        this.removed = true;
        this.death();
    }

    timeStep(World: World): void {}
    frame(Graphics: Graphics, World: World): void {}
    collision(body: Body2d, World: World): boolean {
        return true;
    }
    death(): void {}
}

export class PolygonBody extends Body2d {
    vertices: Array<Tensor>;
    r: number;
    constructor(vertices: Array<Tensor>, options?: options) {
        super(options);
        this.vertices = vertices;
        let g = 0;
        for (const v of vertices) {
            const d = v.magSq();
            if (d > g) g = d;
        }
        this.r = g ** (1 / 2);
    }

    collide(b: Body2d): boolean {
        if (b instanceof CircleBody) {
            return CvC(this.pos, this.r, b.pos, b.r);
        }
        return false;
    }
}

export class RectBody extends PolygonBody {
    w: number;
    h: number;

    constructor(w: number, h: number = w, options?: options) {
        super(
            [
                Tensor.from(-w / 2, -h / 2),
                Tensor.from(w / 2, -h / 2),
                Tensor.from(w / 2, h / 2),
                Tensor.from(-w / 2, h / 2),
            ],
            options
        );
        this.w = w;
        this.h = h;
    }
}

export class CircleBody extends Body2d {
    r: number;

    constructor(r: number, options?: options) {
        super(options);
        this.r = r;
    }

    isColliding(b: Body2d): boolean {
        if (b instanceof CircleBody) return CvC(this.pos, this.r, b.pos, b.r);
        else return false;
    }

    repulse(b: Body2d) {
        if (b instanceof CircleBody) {
            const n = b.pos.clone().sub(this.pos).normalize();
            const rv = b.vel.clone().sub(this.vel);
            const vn = rv.dot(n);
            if (vn > 0) return false;
            const e = 1;
            let j = -(1 + e) * vn;
            j /= this.inverseMass + b.inverseMass;
            const impulse = n.scale(j);
            if (!b.isStatic) b.vel.add(impulse.clone().scale(b.inverseMass));
            if (!this.isStatic) this.vel.sub(impulse.scale(this.inverseMass));
        }
    }
}
