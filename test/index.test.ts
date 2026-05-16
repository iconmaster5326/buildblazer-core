import { describe, test, expect } from "vitest";
import * as uuid from "uuid";

import * as build from "../src/build";
import * as entity from "../src/entity";
import * as expr from "../src/expr";
import * as mod from "../src/mod";
import * as stat from "../src/stat";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

class TestEntity extends entity.Entity {
  entityType(): string {
    return "test";
  }
}

class TestBuild extends build.Build {
  baseEntity(): entity.Entity {
    return new TestEntity({
      id: this.id,
      name: this.name,
    })
  }
  systemName(): string {
    return "test";
  }
  systemVersion(): number {
    return 5326;
  }
}

describe('expressions', () => {
  test('number', () => {
    const e = expr.parseExpression("1");
    expect(e).toBeInstanceOf(expr.ExprNumber);
    expect((e as expr.ExprNumber).value).toBe(1);
  });

  test('add', () => {
    const e = expr.parseExpression("1+2");
    expect(e).toBeInstanceOf(expr.ExprBin);
    expect((e as expr.ExprBin).op).toBe(expr.ExprBinOp.ADD);

    expect((e as expr.ExprBin).lhs).toBeInstanceOf(expr.ExprNumber);
    expect(((e as expr.ExprBin).lhs as expr.ExprNumber).value).toBe(1);

    expect((e as expr.ExprBin).rhs).toBeInstanceOf(expr.ExprNumber);
    expect(((e as expr.ExprBin).rhs as expr.ExprNumber).value).toBe(2);
  });

  test('eval', () => {
    const e = expr.parseExpression("1+2*3");
    const ctx = new TestEntity().evalContext();
    
    expect(e.eval(ctx)).toBe(7);
  });
});

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

  test('entityAfterMilestone', () => {
    const id = uuid.v4();
    const m1 = new build.Milestone({
      changes: [
        new build.ChangeSet(id, "x", 0),
        new build.ChangeSet(id, "x", 1),
      ],
    });
    const m2 = new build.Milestone({
      changes: [
        new build.ChangeSet(id, "x", 2),
        new build.ChangeSet(id, "x", 3),
      ],
    });
    const b = new TestBuild({
      id: id,
      name: "Test",
      milestones: [
        m1,
        m2,
      ],
    });
    const e1 = b.entityAfterMilestone(m1);
    const e2 = b.entityAfterMilestone(m2);

    expect(e1.id).toBe(id);
    expect(e1.name).toBe("Test");
    expect(e1).toHaveProperty("x");
    expect((e1 as any).x).toBe(1);

    expect(e2.id).toBe(id);
    expect(e2.name).toBe("Test");
    expect(e2).toHaveProperty("x");
    expect((e2 as any).x).toBe(3);
  });
});

describe('stats', () => {
  test('create blank', () => {
    const s = new stat.Statistic();

    expect(s.entityType()).toBe("stat");
    expect(s.base).toBe("0");
  });

  test('create initialized', () => {
    const s = new stat.Statistic({name: "Test", base: "5326"});

    expect(s.entityType()).toBe("stat");
    expect(s.name).toBe("Test");
    expect(s.base).toBe("5326");
  });

  test('from JSON', () => {
    const id = uuid.v4();
    const s = entity.Entity.fromJSON({
      id: id,
      name: "Test",
      type: "stat",
      base: "5326",
    });

    expect(s.id).toBe(id);
    expect(s.name).toBe("Test");
    expect(s.entityType()).toBe("stat");
    expect(s).toBeInstanceOf(stat.Statistic);
    expect((s as stat.Statistic).base).toBe("5326");
  });

  test('to JSON', () => {
    const s = new stat.Statistic({base: "5326"});
    const j: any = s.toJSON();

    expect(j.id).toBe(s.id);
    expect(j.type).toBe("stat");
    expect(j.base).toBe("5326");
  });

  test('eval', () => {
    const s = new stat.Statistic({base: "1"});
    const m = new mod.Modifier({stat: s.id, op: mod.ModifierOp.ADD, value: "2"});
    const root = new TestEntity({children: [s, m]});
    const ctx = root.evalContext();

    expect(s.eval(ctx)).toBe(3);
  });
});

describe('mods', () => {
  test('create blank', () => {
    const m = new mod.Modifier();

    expect(m.entityType()).toBe("mod");
    expect(m.name).toBe("");
    expect(m.stat).toBe("");
    expect(m.op).toBe(mod.ModifierOp.ADD);
    expect(m.value).toBe("0");
    expect(m.condition).toBe(undefined);
  });

  test('create initialized', () => {
    const id = uuid.v4();
    const m = new mod.Modifier({
      name: "Test",
      stat: id,
      op: mod.ModifierOp.SET,
      value: "5326",
      condition: "1=2"
    });

    expect(m.entityType()).toBe("mod");
    expect(m.name).toBe("Test");
    expect(m.stat).toBe(id);
    expect(m.op).toBe(mod.ModifierOp.SET);
    expect(m.value).toBe("5326");
    expect(m.condition).toBe("1=2");
  });

  test('from JSON', () => {
    const id = uuid.v4();
    const m = entity.Entity.fromJSON({
      id: id,
      name: "Test",
      type: "mod",
      stat: id,
      op: mod.ModifierOp.SET,
      value: "5326",
      condition: "1=2"
    });

    expect(m.id).toBe(id);
    expect(m.name).toBe("Test");
    expect(m.entityType()).toBe("mod");
    expect(m).toBeInstanceOf(mod.Modifier);
    expect((m as mod.Modifier).stat).toBe(id);
    expect((m as mod.Modifier).op).toBe(mod.ModifierOp.SET);
    expect((m as mod.Modifier).value).toBe("5326");
    expect((m as mod.Modifier).condition).toBe("1=2");
  });

  test('to JSON', () => {
    const m = new mod.Modifier({
      stat: uuid.v4(),
      op: mod.ModifierOp.SET,
      value: "5326",
      condition: "1=2"
    });
    const j: any = m.toJSON();

    expect(j.id).toBe(m.id);
    expect(j.type).toBe("mod");
    expect(j.stat).toBe(m.stat);
    expect(j.op).toBe(m.op);
    expect(j.value).toBe(m.value);
    expect(j.condition).toBe(m.condition);
  });

  test('apply', () => {
    const s = new stat.Statistic({base: "5326"});
    const root = new TestEntity({children: [
      s,
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.SET, value: "0"}),
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.ADD, value: "1"}),
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.SUB, value: "2"}),
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.MUL, value: "3"}),
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.DIV, value: "4"}),
    ]});
    const ctx = root.evalContext();

    expect(s.eval(ctx)).toBe((((0+1)-2)*3)/4);
  });

  test('isApplicable', () => {
    const s = new stat.Statistic({base: "5326"});
    const root = new TestEntity({children: [
      s,
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.SET, value: "2", condition: "1"}),
      new mod.Modifier({stat: s.id, op: mod.ModifierOp.SET, value: "3", condition: "0"}),
    ]});
    const ctx = root.evalContext();

    expect(s.eval(ctx)).toBe(2);
  });
});
