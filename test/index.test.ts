import { describe, test, expect } from "vitest";
import * as uuid from "uuid";

import {
  Build,
  ChangeAdd,
  ChangeDel,
  ChangeSet,
  Milestone,
} from "../src/build";
import { Entity } from "../src/entity";
import {
  parseExpression,
  ExprNumber,
  ExprBin,
  ExprBinOp,
  ExprDice,
} from "../src/expr";
import { Modifier, ModifierOp } from "../src/mod";
import { Statistic } from "../src/stat";
import { Toggle } from "../src/toggle";
import { Counter } from "../src/counter";
import { Buildblazer } from "../src/buildblazer";

const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

class TestEntity extends Entity {
  entityType(): string {
    return "test";
  }
}

class TestBuild extends Build {
  baseEntity(): Entity {
    return new TestEntity({
      id: this.id,
      name: this.name,
    });
  }
  systemName(): string {
    return "test";
  }
  systemVersion(): number {
    return 5326;
  }
}

describe("expressions", () => {
  test("number", () => {
    const e = parseExpression("1");
    expect(e).toBeInstanceOf(ExprNumber);
    expect((e as ExprNumber).value).toBe(1);
  });

  test("add", () => {
    const e = parseExpression("1+2");
    expect(e).toBeInstanceOf(ExprBin);
    expect((e as ExprBin).op).toBe(ExprBinOp.ADD);

    expect((e as ExprBin).lhs).toBeInstanceOf(ExprNumber);
    expect(((e as ExprBin).lhs as ExprNumber).value).toBe(1);

    expect((e as ExprBin).rhs).toBeInstanceOf(ExprNumber);
    expect(((e as ExprBin).rhs as ExprNumber).value).toBe(2);
  });

  test("eval", () => {
    const e = parseExpression("1+2*3");
    const ctx = new TestEntity().evalContext();

    expect(e.eval(ctx)).toBe(7);
  });

  test("simplify const bin op", () => {
    const e = parseExpression("1+2*3");
    const ctx = new TestEntity().evalContext();
    const simplified = e.simplify(ctx);

    expect(simplified).toBeInstanceOf(ExprNumber);
    expect((simplified as ExprNumber).value).toBe(7);
  });

  test("simplify dice bin op", () => {
    const e = parseExpression("1d2+3+4");
    const ctx = new TestEntity().evalContext();
    const simplified = e.simplify(ctx);

    expect(simplified).toBeInstanceOf(ExprBin);
    expect(simplified.toString()).toBe("1d2 + 7");
  });

  test("simplify dice pile", () => {
    const e = parseExpression("1d2+3+1d8-4");
    const ctx = new TestEntity().evalContext();
    const simplified = e.simplify(ctx);

    expect(simplified).toBeInstanceOf(ExprBin);
    expect(simplified.toString()).toBe("1d2 + 1d8 - 1");
  });

  test("simplify double negative", () => {
    const e = parseExpression("-(-1d6)");
    const ctx = new TestEntity().evalContext();
    const simplified = e.simplify(ctx);

    expect(simplified).toBeInstanceOf(ExprDice);
    expect(simplified.toString()).toBe("1d6");
  });

  test("toString precedence", () => {
    expect(parseExpression("(1)d6").toString()).toBe("1d6");
    expect(parseExpression("(1+2)d6").toString()).toBe("(1 + 2)d6");
    expect(parseExpression("(-1)d6").toString()).toBe("(-1)d6");
    expect(parseExpression("-1d6").toString()).toBe("-1d6");
    expect(parseExpression("1+2*3").toString()).toBe("1 + 2 * 3");
    expect(parseExpression("(1+2)*3").toString()).toBe("(1 + 2) * 3");
  });

  test("if simplify", () => {
    const ctx = new TestEntity().evalContext();

    expect(
      parseExpression("if 1 then 1d2 else 3d4").simplify(ctx).toString(),
    ).toBe("1d2");
    expect(
      parseExpression("if 0 then 1d2 else 3d4").simplify(ctx).toString(),
    ).toBe("3d4");
    expect(
      parseExpression("if 1d2 then 3 else 4").simplify(ctx).toString(),
    ).toBe("if 1d2 then 3 else 4");
  });

  test("var syntax", () => {
    expect(parseExpression("x").toString()).toBe("x");
    expect(parseExpression("x. y").toString()).toBe("x.y");
    expect(parseExpression("x.y. z").toString()).toBe("x.y.z");
  });

  test("method call syntax", () => {
    expect(parseExpression("x()").toString()).toBe("x()");
    expect(parseExpression("x(y)").toString()).toBe("x(y)");
    expect(parseExpression("x(y,)").toString()).toBe("x(y)");
    expect(parseExpression("x(y,z)").toString()).toBe("x(y, z)");
    expect(parseExpression("x(y,z,)").toString()).toBe("x(y, z)");
    expect(parseExpression("x.y()").toString()).toBe("x.y()");
  });

  test("tag syntax", () => {
    expect(parseExpression("x").tags).toHaveLength(0);
    expect(parseExpression("x#y").tags).toHaveLength(1);
    expect(parseExpression("x#y#z").tags).toHaveLength(2);
    expect(parseExpression("1d6#x").tags).toHaveLength(1);
    expect(parseExpression("1d(6#x)").tags).toHaveLength(0);
    expect(parseExpression("1#x").tags).toHaveLength(1);
    expect(parseExpression("+1#x").tags).toHaveLength(1);
    expect(parseExpression("-1#x").tags).toHaveLength(1);
  });

  test("dice options", () => {
    expect((parseExpression("1d6") as ExprDice).keepHighest).toBe(undefined);
    expect(
      (parseExpression("1d6kh1") as ExprDice).keepHighest?.toString(),
    ).toBe("1");

    expect((parseExpression("1d6") as ExprDice).keepLowest).toBe(undefined);
    expect((parseExpression("1d6kl1") as ExprDice).keepLowest?.toString()).toBe(
      "1",
    );

    expect((parseExpression("1d6") as ExprDice).dropHighest).toBe(undefined);
    expect(
      (parseExpression("1d6dh1") as ExprDice).dropHighest?.toString(),
    ).toBe("1");

    expect((parseExpression("1d6") as ExprDice).dropLowest).toBe(undefined);
    expect((parseExpression("1d6dl1") as ExprDice).dropLowest?.toString()).toBe(
      "1",
    );

    expect((parseExpression("1d6") as ExprDice).explode).toBe(false);
    expect((parseExpression("1d6ex") as ExprDice).explode).toBe(true);
  });

  test("multiple dice options", () => {
    const bigExpr = parseExpression("1d6kh(a)kl(b)dh(c)dl(d)ex") as ExprDice;
    expect(bigExpr.toString()).toBe("1d6kh(a)kl(b)dh(c)dl(d)ex");
    expect(bigExpr.keepHighest?.toString()).toBe("a");
    expect(bigExpr.keepLowest?.toString()).toBe("b");
    expect(bigExpr.dropHighest?.toString()).toBe("c");
    expect(bigExpr.dropLowest?.toString()).toBe("d");
    expect(bigExpr.explode).toBe(true);
  });

  test("shuffled dice options", () => {
    const shuffledExpr = parseExpression(
      "1d6exdl(d)dh(c)kl(b)kh(a)",
    ) as ExprDice;
    expect(shuffledExpr.toString()).toBe("1d6kh(a)kl(b)dh(c)dl(d)ex");
    expect(shuffledExpr.keepHighest?.toString()).toBe("a");
    expect(shuffledExpr.keepLowest?.toString()).toBe("b");
    expect(shuffledExpr.dropHighest?.toString()).toBe("c");
    expect(shuffledExpr.dropLowest?.toString()).toBe("d");
    expect(shuffledExpr.explode).toBe(true);
  });

  test("duplicate dice options", () => {
    expect(parseExpression("1d6exexexex").toString()).toBe("1d6ex");
  });
});

describe("entities", () => {
  test("create blank", () => {
    const e = new TestEntity();

    expect(e.id).toBeTypeOf("string");
    expect(e.id).toMatch(uuidRegex);
    expect(e.name).toBe("");
    expect(e.varName).toBe("");
    expect(e.children).toHaveLength(0);
    expect(e.instanceOf).toBeUndefined();
  });

  test("create with properties", () => {
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
      },
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

  test("uuid mapping", () => {
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

describe("builds", () => {
  test("create blank", () => {
    const b = new TestBuild();

    expect(b.id).toBeTypeOf("string");
    expect(b.id).toMatch(uuidRegex);
    expect(b.name).toBe("");
    expect(b.loadedSystemVersion).toBe(5326);
    expect(b.milestones).toHaveLength(0);
    expect(b.sheets).toHaveLength(0);
  });

  test("apply set change", () => {
    const subject = new TestEntity();
    const object = new TestEntity();
    const c = new ChangeSet(subject.id, "x", object);

    expect(c.apply(subject.uuidMap())).toBe(true);
    expect(subject).toHaveProperty("x");
    expect((subject as any).x).toBe(object);
  });

  test("apply add change", () => {
    const subject = new TestEntity();
    (subject as any).x = [];
    const object = new TestEntity();
    const c = new ChangeAdd(subject.id, "x", object);

    expect(c.apply(subject.uuidMap())).toBe(true);
    expect((subject as any).x).toHaveLength(1);
    expect((subject as any).x).toContain(object);
  });

  test("apply del change", () => {
    const object = new TestEntity();
    const subject = new TestEntity();
    (subject as any).x = [object];
    const c = new ChangeDel(subject.id, "x", object.id);

    expect(c.apply(subject.uuidMap())).toBe(true);
    expect((subject as any).x).toHaveLength(0);
  });

  test("entityAfterMilestone", () => {
    const id = uuid.v4();
    const m1 = new Milestone({
      changes: [new ChangeSet(id, "x", 0), new ChangeSet(id, "x", 1)],
    });
    const m2 = new Milestone({
      changes: [new ChangeSet(id, "x", 2), new ChangeSet(id, "x", 3)],
    });
    const b = new TestBuild({
      id: id,
      name: "Test",
      milestones: [m1, m2],
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

describe("stats", () => {
  test("create blank", () => {
    const s = new Statistic();

    expect(s.entityType()).toBe("stat");
    expect(s.base).toBe("0");
  });

  test("create initialized", () => {
    const s = new Statistic({ name: "Test", base: "5326" });

    expect(s.entityType()).toBe("stat");
    expect(s.name).toBe("Test");
    expect(s.base).toBe("5326");
  });

  test("from JSON", () => {
    const bb = new Buildblazer();
    const id = uuid.v4();
    const s = bb.entityFromJSON({
      id: id,
      name: "Test",
      type: "stat",
      base: "5326",
    });

    expect(s.id).toBe(id);
    expect(s.name).toBe("Test");
    expect(s.entityType()).toBe("stat");
    expect(s).toBeInstanceOf(Statistic);
    expect((s as Statistic).base).toBe("5326");
  });

  test("to JSON", () => {
    const s = new Statistic({ base: "5326" });
    const j: any = s.toJSON();

    expect(j.id).toBe(s.id);
    expect(j.type).toBe("stat");
    expect(j.base).toBe("5326");
  });

  test("eval", () => {
    const s = new Statistic({ base: "1" });
    const m = new Modifier({ stat: s.id, op: ModifierOp.ADD, value: "2" });
    const root = new TestEntity({ children: [s, m] });
    const ctx = root.evalContext();

    expect(s.eval(ctx)).toBe(3);
  });

  test("valueExpr", () => {
    const s = new Statistic({ base: "1d6" });
    const m1 = new Modifier({ stat: s.id, op: ModifierOp.ADD, value: "3" });
    const m2 = new Modifier({ stat: s.id, op: ModifierOp.SUB, value: "1" });
    const root = new TestEntity({ children: [s, m1, m2] });
    const ctx = root.evalContext();
    const result = s.valueExpr(ctx);

    expect(result.toString()).toBe("1d6 + 2");
  });
});

describe("mods", () => {
  test("create blank", () => {
    const m = new Modifier();

    expect(m.entityType()).toBe("mod");
    expect(m.name).toBe("");
    expect(m.stat).toBe("");
    expect(m.op).toBe(ModifierOp.ADD);
    expect(m.value).toBe("0");
    expect(m.condition).toBe(undefined);
  });

  test("create initialized", () => {
    const id = uuid.v4();
    const m = new Modifier({
      name: "Test",
      stat: id,
      op: ModifierOp.SET,
      value: "5326",
      condition: "1=2",
    });

    expect(m.entityType()).toBe("mod");
    expect(m.name).toBe("Test");
    expect(m.stat).toBe(id);
    expect(m.op).toBe(ModifierOp.SET);
    expect(m.value).toBe("5326");
    expect(m.condition).toBe("1=2");
  });

  test("from JSON", () => {
    const bb = new Buildblazer();
    const id = uuid.v4();
    const m = bb.entityFromJSON({
      id: id,
      name: "Test",
      type: "mod",
      stat: id,
      op: ModifierOp.SET,
      value: "5326",
      condition: "1=2",
    });

    expect(m.id).toBe(id);
    expect(m.name).toBe("Test");
    expect(m.entityType()).toBe("mod");
    expect(m).toBeInstanceOf(Modifier);
    expect((m as Modifier).stat).toBe(id);
    expect((m as Modifier).op).toBe(ModifierOp.SET);
    expect((m as Modifier).value).toBe("5326");
    expect((m as Modifier).condition).toBe("1=2");
  });

  test("to JSON", () => {
    const m = new Modifier({
      stat: uuid.v4(),
      op: ModifierOp.SET,
      value: "5326",
      condition: "1=2",
    });
    const j: any = m.toJSON();

    expect(j.id).toBe(m.id);
    expect(j.type).toBe("mod");
    expect(j.stat).toBe(m.stat);
    expect(j.op).toBe(m.op);
    expect(j.value).toBe(m.value);
    expect(j.condition).toBe(m.condition);
  });

  test("apply", () => {
    const s = new Statistic({ base: "5326" });
    const root = new TestEntity({
      children: [
        s,
        new Modifier({ stat: s.id, op: ModifierOp.SET, value: "0" }),
        new Modifier({ stat: s.id, op: ModifierOp.ADD, value: "1" }),
        new Modifier({ stat: s.id, op: ModifierOp.SUB, value: "2" }),
        new Modifier({ stat: s.id, op: ModifierOp.MUL, value: "3" }),
        new Modifier({ stat: s.id, op: ModifierOp.DIV, value: "4" }),
      ],
    });
    const ctx = root.evalContext();

    expect(s.eval(ctx)).toBe(((0 + 1 - 2) * 3) / 4);
  });

  test("isApplicable", () => {
    const s = new Statistic({ base: "5326" });
    const root = new TestEntity({
      children: [
        s,
        new Modifier({
          stat: s.id,
          op: ModifierOp.SET,
          value: "2",
          condition: "1",
        }),
        new Modifier({
          stat: s.id,
          op: ModifierOp.SET,
          value: "3",
          condition: "0",
        }),
      ],
    });
    const ctx = root.evalContext();

    expect(s.eval(ctx)).toBe(2);
  });
});

describe("toggles", () => {
  test("create blank", () => {
    const t = new Toggle();

    expect(t.entityType()).toBe("toggle");
    expect(t.name).toBe("");
  });

  test("create initialized", () => {
    const t = new Toggle({
      name: "Test",
    });

    expect(t.entityType()).toBe("toggle");
    expect(t.name).toBe("Test");
  });

  test("from JSON", () => {
    const bb = new Buildblazer();
    const id = uuid.v4();
    const t = bb.entityFromJSON({
      id: id,
      name: "Test",
      type: "toggle",
    });

    expect(t.id).toBe(id);
    expect(t.name).toBe("Test");
    expect(t.entityType()).toBe("toggle");
    expect(t).toBeInstanceOf(Toggle);
  });
});

describe("counters", () => {
  test("create blank", () => {
    const c = new Counter();

    expect(c.entityType()).toBe("counter");
    expect(c.name).toBe("");
    expect(c.defaultsTo).toBe("");
    expect(c.min).toBe("");
    expect(c.max).toBe("");
  });

  test("create initialized", () => {
    const c = new Counter({
      name: "Test",
      defaultsTo: "1",
      min: "2",
      max: "3",
    });

    expect(c.entityType()).toBe("counter");
    expect(c.name).toBe("Test");
    expect(c.defaultsTo).toBe("1");
    expect(c.min).toBe("2");
    expect(c.max).toBe("3");
  });

  test("from JSON", () => {
    const bb = new Buildblazer();
    const id = uuid.v4();
    const c = bb.entityFromJSON({
      id: id,
      name: "Test",
      type: "counter",
      defaultsTo: "1",
      min: "2",
      max: "3",
    });

    expect(c.id).toBe(id);
    expect(c.name).toBe("Test");
    expect(c.entityType()).toBe("counter");
    expect(c).toBeInstanceOf(Counter);
    expect((c as Counter).defaultsTo).toBe("1");
    expect((c as Counter).min).toBe("2");
    expect((c as Counter).max).toBe("3");
  });
});
