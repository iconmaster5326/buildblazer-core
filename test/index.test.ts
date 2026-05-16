import { describe, test, expect } from "vitest";
import * as uuid from "uuid";

import * as expressions from "../src/expressions";
import * as entity from "../src/entity";

describe('expression language support', () => {
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

describe('entities', () => {
  class TestEntity extends entity.Entity {
    typeString(): string {
      return "test";
    }
  }

  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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
});
