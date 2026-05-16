import { describe, test, expect } from "vitest";
import * as uuid from "uuid";

import * as build from "../src/build";
import * as expressions from "../src/expressions";
import * as entity from "../src/entity";

describe('expressions', () => {
  test('number', () => {
    const expr = expressions.parseExpression("1");
    expect(expr).toBeInstanceOf(expressions.ExprNumber);
    expect((expr as expressions.ExprNumber).value).toBe(1);
  });
  test('add', () => {
    const expr = expressions.parseExpression("1+2");
    expect(expr).toBeInstanceOf(expressions.ExprBin);
    expect((expr as expressions.ExprBin).op).toBe(expressions.ExprBinOp.ADD);

    expect((expr as expressions.ExprBin).lhs).toBeInstanceOf(expressions.ExprNumber);
    expect(((expr as expressions.ExprBin).lhs as expressions.ExprNumber).value).toBe(1);

    expect((expr as expressions.ExprBin).rhs).toBeInstanceOf(expressions.ExprNumber);
    expect(((expr as expressions.ExprBin).rhs as expressions.ExprNumber).value).toBe(2);
  });
});

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

class TestEntity extends entity.Entity {
  typeString(): string {
    return "test";
  }
}

describe('entities', () => {
  test('create blank', () => {
    const e = new TestEntity();

    expect(e.id).toBeTypeOf("string");
    expect(e.id).toMatch(uuidRegex);
    expect(e.name).toBe("");
    expect(e.varName).toBe("");
    expect(e.children).toHaveLength(0);
    expect(e.instanceOf).toBeUndefined();
  });

  test('create with properties', () => {
    const id = uuid.v4();
    const dbid = uuid.v4();
    const entryid = uuid.v4();
    const child1 = new TestEntity();
    const child2 = new TestEntity();
    const e = new TestEntity({
      id: id,
      name: "Test",
      varName: "x",
      children: [child1, child2],
      instanceOf: {
        database: dbid,
        entry: entryid,
        version: 5326,
      }
    });

    expect(e.id).toBe(id);
    expect(e.name).toBe("Test");
    expect(e.varName).toBe("x");
    expect(e.children).toHaveLength(2);
    expect(e.children[0]).toBe(child1);
    expect(e.children[1]).toBe(child2);
    expect(e.instanceOf).toBeTypeOf("object");
    expect(e.instanceOf?.database).toBe(dbid);
    expect(e.instanceOf?.entry).toBe(entryid);
    expect(e.instanceOf?.version).toBe(5326);
  });

  test('uuid mapping', () => {
    const c1 = new TestEntity();
    const c2 = new TestEntity({
      children: [c1],
    });
    const c3 = new TestEntity();
    const e = new TestEntity({
      children: [c2, c3],
    });
    const uuidMap = e.uuidMap();
    const keys = Object.keys(uuidMap);
    const values = Object.values(uuidMap);

    expect(keys).toHaveLength(4);
    expect(keys).toContain(e.id);
    expect(keys).toContain(c1.id);
    expect(keys).toContain(c2.id);
    expect(keys).toContain(c3.id);

    expect(values).toHaveLength(4);
    expect(values).toContain(e);
    expect(values).toContain(c1);
    expect(values).toContain(c2);
    expect(values).toContain(c3);
  });
});

class TestBuild extends build.Build {
  systemName(): string {
    return "test";
  }
  systemVersion(): number {
    return 5326;
  }
}

describe('builds', () => {
  test('create blank', () => {
    const b = new TestBuild();

    expect(b.id).toBeTypeOf("string");
    expect(b.id).toMatch(uuidRegex);
    expect(b.name).toBe("");
    expect(b.loadedSystemVersion).toBe(5326);
    expect(b.milestones).toHaveLength(0);
    expect(b.sheets).toHaveLength(0);
  });

  test('apply set change', () => {
    const subject = new TestEntity();
    const object = new TestEntity();
    const c = new build.ChangeSet(subject.id, "x", object);

    expect(c.apply(subject.uuidMap())).toBe(true);
    expect(subject).toHaveProperty("x");
    expect((subject as any).x).toBe(object);
  });

  test('apply add change', () => {
    const subject = new TestEntity();
    (subject as any).x = [];
    const object = new TestEntity();
    const c = new build.ChangeAdd(subject.id, "x", object);
    
    expect(c.apply(subject.uuidMap())).toBe(true);
    expect((subject as any).x).toHaveLength(1);
    expect((subject as any).x).toContain(object);
  });

  test('apply del change', () => {
    const object = new TestEntity();
    const subject = new TestEntity();
    (subject as any).x = [object];
    const c = new build.ChangeDel(subject.id, "x", object.id);
    
    expect(c.apply(subject.uuidMap())).toBe(true);
    expect((subject as any).x).toHaveLength(0);
  });
});
