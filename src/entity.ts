import * as uuid from "uuid";

// @ts-ignore
import { WeakValueMap } from "./util";

export interface DatabaseReference {
    database: string;
    entry: string;
    version?: number;
}

export interface EntityOptions {
    id?: string
    name?: string;
    varName?: string;
    children?: Entity[];
    instanceOf?: DatabaseReference;
}

export abstract class Entity {
    id: string;
    name: string;
    varName: string;
    children: Entity[];
    instanceOf: DatabaseReference | undefined;

    constructor(options: EntityOptions = {}) {
        this.id = options.id ?? uuid.v4();
        this.name = options.name ?? "";
        this.varName = options.varName ?? "";
        this.children = Array.from(options.children ?? []);
        this.instanceOf = options.instanceOf;

        allEntities.set(this.id, this);
    }

    abstract typeString(): string;

    toJSON(): object {
        return {
            id: this.id,
            ...(this.name ? {name: this.name} : {}),
            ...(this.varName ? {varName: this.varName} : {}),
            ...(this.children ? {children: this.children.map(x => x.toJSON())} : {}),
            ...(this.instanceOf ? {instanceOf: this.instanceOf} : {}),
        };
    }
}

export const allEntities: WeakValueMap<string, Entity> = new WeakValueMap<string, Entity>();
