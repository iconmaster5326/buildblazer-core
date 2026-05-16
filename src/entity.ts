import * as uuid from "uuid";

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
    }

    abstract entityType(): string;

    toJSON(): object {
        return {
            id: this.id,
            type: this.entityType(),
            ...(this.name ? {name: this.name} : {}),
            ...(this.varName ? {varName: this.varName} : {}),
            ...(this.children ? {children: this.children.map(x => x.toJSON())} : {}),
            ...(this.instanceOf ? {instanceOf: this.instanceOf} : {}),
        };
    }

    uuidMap(map?: Record<string, Entity>): Record<string, Entity> {
        if (map === undefined) {
            map = {};
        } else if (map[this.id]) {
            throw new Error("Two entities have the same UUID!");
        }
        map[this.id] = this;
        this.children.forEach(child => {
            child.uuidMap(map);
        });
        return map;
    }

    static fromJSON(json: any): Entity {
        const t: string = json["type"];
        const handler = Entity.FROM_JSON_REGISTRY[t];
        if (handler === undefined) {
            throw new Error(`Unknown entity type '${t}'!`);
        }
        return handler(json);
    }

    static FROM_JSON_REGISTRY: Record<string, (json: any) => Entity> = {};
}
