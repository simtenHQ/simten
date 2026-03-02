/**
 * CST to AST Visitor
 *
 * Converts Chevrotain's Concrete Syntax Tree (CST) to our AST types.
 * This is a pure function that transforms the tree structure.
 *
 * The AST layer is the contract - parser is just an implementation detail.
 * Later, tree-sitter would produce the same AST via treeToAst().
 */

import { CstNode, IToken } from 'chevrotain';
import {
  Program,
  CircuitDef,
  ParameterDecl,
  ParameterType,
  InputDecl,
  OutputDecl,
  ClockDecl,
  StateDecl,
  ImplBlock,
  NodeDecl,
  ConnectionStmt,
  PortRef,
  TypeExpr,
  Argument,
  ArgumentValue,
  ArrayLiteral,
  ObjectLiteral,
  OnClockStmt,
  Statement,
  Assignment,
  ConditionalStmt,
  Expr,
  SourceRange,
  createRange,
  StateTypeExpr,
  MemoryTypeExpr,
} from '../../types/ast.js';
import {
  TestbenchDef,
  CircuitRef,
  TestInputDecl,
  TestOutputDecl,
  TestClockDecl,
  TestImplBlock,
  TestNodeDecl,
  TestConnectionStmt,
  StimulusBlock,
  StimulusEvent,
  StimulusTiming,
  StimulusAssignment,
  CaptureBlock,
  FrequencyExpr,
  AssertBlock,
  Assertion,
} from '../../types/testbench-ast.js';
import { parseNumberLiteral, parseStringLiteral, tokenTypeToOperator } from './tokens.js';

// ============================================================================
// CST Node Type Helpers
// ============================================================================

interface CstChildrenDict {
  [key: string]: (CstNode | IToken)[];
}

function getChildren(node: CstNode): CstChildrenDict {
  return node.children as CstChildrenDict;
}

function getToken(children: CstChildrenDict, name: string, index = 0): IToken | undefined {
  const arr = children[name];
  if (!arr) return undefined;
  return arr[index] as IToken;
}

function getNode(children: CstChildrenDict, name: string, index = 0): CstNode | undefined {
  const arr = children[name];
  if (!arr) return undefined;
  return arr[index] as CstNode;
}

function getAllNodes(children: CstChildrenDict, name: string): CstNode[] {
  const arr = children[name];
  if (!arr) return [];
  return arr as CstNode[];
}

function getAllTokens(children: CstChildrenDict, name: string): IToken[] {
  const arr = children[name];
  if (!arr) return [];
  return arr as IToken[];
}

// ============================================================================
// Location Helpers
// ============================================================================

function tokenLocation(token: IToken): SourceRange {
  const startLine = token.startLine ?? 1;
  const startColumn = token.startColumn ?? 1;
  const endLine = token.endLine ?? startLine;
  const endColumn = token.endColumn ?? startColumn;
  return {
    start: { line: startLine, column: startColumn, offset: token.startOffset },
    end: { line: endLine, column: endColumn + 1, offset: (token.endOffset ?? token.startOffset) + 1 },
  };
}

function nodeLocation(node: CstNode): SourceRange {
  // Walk the CST to find first and last tokens
  const tokens = collectTokens(node);
  if (tokens.length === 0) {
    return { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return {
    start: {
      line: first.startLine ?? 1,
      column: first.startColumn ?? 1,
      offset: first.startOffset,
    },
    end: {
      line: last.endLine ?? 1,
      column: (last.endColumn ?? 0) + 1,
      offset: (last.endOffset ?? 0) + 1,
    },
  };
}

function collectTokens(node: CstNode): IToken[] {
  const tokens: IToken[] = [];
  const children = node.children;
  for (const key in children) {
    const arr = children[key];
    if (!arr) continue;
    for (const child of arr) {
      if ('children' in child) {
        tokens.push(...collectTokens(child as CstNode));
      } else {
        tokens.push(child as IToken);
      }
    }
  }
  // Sort by offset
  tokens.sort((a, b) => a.startOffset - b.startOffset);
  return tokens;
}

// ============================================================================
// AST Visitor Class
// ============================================================================

export class CstToAstVisitor {
  // ==========================================================================
  // Program
  // ==========================================================================

  visitProgram(ctx: CstNode): Program {
    const children = getChildren(ctx);
    const circuits: CircuitDef[] = [];
    const testbenches: TestbenchDef[] = [];

    for (const circuitNode of getAllNodes(children, 'circuitDefinition')) {
      circuits.push(this.visitCircuitDefinition(circuitNode));
    }

    for (const testbenchNode of getAllNodes(children, 'testbenchDefinition')) {
      testbenches.push(this.visitTestbenchDefinition(testbenchNode));
    }

    return {
      circuits,
      testbenches: testbenches.length > 0 ? testbenches : undefined,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Circuit Definition
  // ==========================================================================

  visitCircuitDefinition(ctx: CstNode): CircuitDef {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const name = nameToken.image;

    const parametersNode = getNode(children, 'parameters');
    const parameters = parametersNode ? this.visitParameters(parametersNode) : [];

    const inputs: InputDecl[] = [];
    const outputs: OutputDecl[] = [];
    const clocks: ClockDecl[] = [];
    const state: StateDecl[] = [];

    for (const inputNode of getAllNodes(children, 'inputDeclaration')) {
      inputs.push(this.visitInputDeclaration(inputNode));
    }
    for (const outputNode of getAllNodes(children, 'outputDeclaration')) {
      outputs.push(this.visitOutputDeclaration(outputNode));
    }
    for (const clockNode of getAllNodes(children, 'clockDeclaration')) {
      clocks.push(this.visitClockDeclaration(clockNode));
    }
    for (const stateNode of getAllNodes(children, 'stateDeclaration')) {
      state.push(this.visitStateDeclaration(stateNode));
    }

    const implBlockNode = getNode(children, 'implBlock');
    const impl = implBlockNode ? this.visitImplBlock(implBlockNode) : undefined;

    const descToken = getToken(children, 'descriptionText');
    const description = descToken ? parseStringLiteral(descToken.image) : undefined;

    return {
      name,
      parameters,
      inputs,
      outputs,
      clocks,
      state,
      impl,
      description,
      location: nodeLocation(ctx),
    };
  }

  visitParameters(ctx: CstNode): ParameterDecl[] {
    const children = getChildren(ctx);
    const params: ParameterDecl[] = [];
    for (const paramNode of getAllNodes(children, 'parameterDecl')) {
      params.push(this.visitParameterDecl(paramNode));
    }
    return params;
  }

  visitParameterDecl(ctx: CstNode): ParameterDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const name = nameToken.image;

    const typeNode = getNode(children, 'parameterType')!;
    const paramType = this.visitParameterType(typeNode);

    const literalNode = getNode(children, 'literal');
    let defaultValue: number | string | boolean | undefined;
    if (literalNode) {
      const literalValue = this.visitLiteral(literalNode);
      if (typeof literalValue === 'number' || typeof literalValue === 'string' || typeof literalValue === 'boolean') {
        defaultValue = literalValue;
      }
    }

    return {
      name,
      paramType,
      defaultValue,
      location: nodeLocation(ctx),
    };
  }

  visitParameterType(ctx: CstNode): ParameterType {
    const children = getChildren(ctx);
    const typeToken = getToken(children, 'type');
    if (!typeToken) return 'int'; // Default for incomplete parse
    const typeStr = typeToken.image.toLowerCase();
    if (typeStr === 'int') return 'int';
    if (typeStr === 'string') return 'string';
    if (typeStr === 'bool') return 'bool';
    return 'int'; // Default for unrecognized type; later validation will catch it
  }

  // ==========================================================================
  // Port Declarations
  // ==========================================================================

  visitInputDeclaration(ctx: CstNode): InputDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name');
    const typeNode = getNode(children, 'typeExpr');

    // Best-effort: mark incomplete if missing required parts
    if (!nameToken || !typeNode) {
      return {
        name: nameToken?.image ?? '',
        portType: typeNode ? this.visitTypeExpr(typeNode) : { kind: 'bit', location: nodeLocation(ctx) },
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    return {
      name: nameToken.image,
      portType: this.visitTypeExpr(typeNode),
      location: nodeLocation(ctx),
    };
  }

  visitOutputDeclaration(ctx: CstNode): OutputDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name');
    const typeNode = getNode(children, 'typeExpr');

    // Best-effort: mark incomplete if missing required parts
    if (!nameToken || !typeNode) {
      return {
        name: nameToken?.image ?? '',
        portType: typeNode ? this.visitTypeExpr(typeNode) : { kind: 'bit', location: nodeLocation(ctx) },
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    return {
      name: nameToken.image,
      portType: this.visitTypeExpr(typeNode),
      location: nodeLocation(ctx),
    };
  }

  visitClockDeclaration(ctx: CstNode): ClockDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name');

    // Best-effort: mark incomplete if missing required parts
    if (!nameToken) {
      return {
        name: '',
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    return {
      name: nameToken.image,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // State Declaration
  // ==========================================================================

  visitStateDeclaration(ctx: CstNode): StateDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name');
    const typeNode = getNode(children, 'stateTypeExpr');

    // Best-effort: mark incomplete if missing required parts
    if (!nameToken || !typeNode) {
      return {
        name: nameToken?.image ?? '',
        stateType: typeNode ? this.visitStateTypeExpr(typeNode) : { kind: 'bit', location: nodeLocation(ctx) },
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    const literalNode = getNode(children, 'literal');
    let initialValue: number | string | boolean | undefined;
    if (literalNode) {
      const literalValue = this.visitLiteral(literalNode);
      if (typeof literalValue === 'number' || typeof literalValue === 'string' || typeof literalValue === 'boolean') {
        initialValue = literalValue;
      }
    }

    return {
      name: nameToken.image,
      stateType: this.visitStateTypeExpr(typeNode),
      initialValue,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Type Expressions
  // ==========================================================================

  visitTypeExpr(ctx: CstNode): TypeExpr {
    const children = getChildren(ctx);
    const bitNode = getNode(children, 'bitType');
    if (bitNode) {
      return { kind: 'bit', location: nodeLocation(bitNode) };
    }
    const busNode = getNode(children, 'busType');
    if (busNode) {
      return this.visitBusType(busNode);
    }
    // Best-effort: return incomplete bit type instead of throwing
    return { kind: 'bit', location: nodeLocation(ctx), isIncomplete: true };
  }

  visitBusType(ctx: CstNode): TypeExpr {
    const children = getChildren(ctx);
    const widthNode = getNode(children, 'widthExpr');

    // Best-effort: return incomplete bus type if width is missing
    if (!widthNode) {
      return {
        kind: 'bus',
        width: 1,
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    const width = this.visitWidthExpr(widthNode);

    return {
      kind: 'bus',
      width,
      location: nodeLocation(ctx),
    };
  }

  visitWidthExpr(ctx: CstNode): number | { name: string; location: SourceRange } {
    const children = getChildren(ctx);
    const numberToken = getToken(children, 'NumberLiteral');
    if (numberToken) {
      return parseNumberLiteral(numberToken.image);
    }
    const identToken = getToken(children, 'Identifier');
    if (identToken) {
      return { name: identToken.image, location: tokenLocation(identToken) };
    }
    // Best-effort: return default width instead of throwing
    return 1;
  }

  visitStateTypeExpr(ctx: CstNode): StateTypeExpr {
    const children = getChildren(ctx);
    const memoryNode = getNode(children, 'memoryType');
    if (memoryNode) {
      return this.visitMemoryType(memoryNode);
    }
    const typeNode = getNode(children, 'typeExpr');
    if (typeNode) {
      return this.visitTypeExpr(typeNode);
    }
    // Best-effort: return incomplete bit type instead of throwing
    return { kind: 'bit', location: nodeLocation(ctx), isIncomplete: true };
  }

  visitMemoryType(ctx: CstNode): MemoryTypeExpr {
    const children = getChildren(ctx);
    const loc = nodeLocation(ctx);
    const sizeToken = getToken(children, 'size');
    if (!sizeToken) {
      return { kind: 'memory', addressWidth: 8, dataWidth: 8, location: loc, isIncomplete: true };
    }
    const size = parseNumberLiteral(sizeToken.image);
    const addressWidth = Math.log2(size);
    if (!Number.isInteger(addressWidth) || addressWidth < 0) {
      return { kind: 'memory', addressWidth: 8, dataWidth: 8, location: loc, isIncomplete: true };
    }

    const typeNode = getNode(children, 'typeExpr');
    if (!typeNode) {
      return { kind: 'memory', addressWidth, dataWidth: 8, location: loc, isIncomplete: true };
    }
    const elementType = this.visitTypeExpr(typeNode);
    let dataWidth: number;
    if (elementType.kind === 'bit') {
      dataWidth = 1;
    } else if (elementType.kind === 'bus') {
      if (typeof elementType.width === 'number') {
        dataWidth = elementType.width;
      } else {
        return { kind: 'memory', addressWidth, dataWidth: 8, location: loc, isIncomplete: true };
      }
    } else {
      return { kind: 'memory', addressWidth, dataWidth: 8, location: loc, isIncomplete: true };
    }

    return {
      kind: 'memory',
      addressWidth,
      dataWidth,
      location: loc,
    };
  }

  // ==========================================================================
  // Implementation Block
  // ==========================================================================

  visitImplBlock(ctx: CstNode): ImplBlock {
    const children = getChildren(ctx);
    const nodes: NodeDecl[] = [];
    const connections: ConnectionStmt[] = [];
    const statements: Statement[] = [];

    for (const itemNode of getAllNodes(children, 'implItem')) {
      const itemChildren = getChildren(itemNode);
      const nodeDecl = getNode(itemChildren, 'nodeDeclaration');
      if (nodeDecl) {
        nodes.push(this.visitNodeDeclaration(nodeDecl));
        continue;
      }
      const connectStmt = getNode(itemChildren, 'connectStatement');
      if (connectStmt) {
        connections.push(this.visitConnectStatement(connectStmt));
        continue;
      }
      const onClockStmt = getNode(itemChildren, 'onClockStatement');
      if (onClockStmt) {
        statements.push(this.visitOnClockStatement(onClockStmt));
        continue;
      }
      const assignment = getNode(itemChildren, 'assignment');
      if (assignment) {
        statements.push(this.visitAssignment(assignment));
        continue;
      }
    }

    return {
      nodes,
      connections,
      statements,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Node Declaration
  // ==========================================================================

  visitNodeDeclaration(ctx: CstNode): NodeDecl {
    const children = getChildren(ctx);
    const instanceNameToken = getToken(children, 'instanceName');
    const componentTypeToken = getToken(children, 'componentType');

    // Best-effort: mark incomplete if missing required parts
    if (!instanceNameToken || !componentTypeToken) {
      return {
        instanceName: instanceNameToken?.image ?? '',
        componentType: componentTypeToken?.image ?? '',
        arguments: [],
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    const argumentsNode = getNode(children, 'arguments');
    const args = argumentsNode ? this.visitArguments(argumentsNode) : [];

    return {
      instanceName: instanceNameToken.image,
      componentType: componentTypeToken.image,
      arguments: args,
      location: nodeLocation(ctx),
    };
  }

  visitArguments(ctx: CstNode): Argument[] {
    const children = getChildren(ctx);
    const args: Argument[] = [];
    for (const argNode of getAllNodes(children, 'argument')) {
      args.push(this.visitArgument(argNode));
    }
    return args;
  }

  visitArgument(ctx: CstNode): Argument {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const valueNode = getNode(children, 'argumentValue')!;

    return {
      name: nameToken.image,
      value: this.visitArgumentValue(valueNode),
      location: nodeLocation(ctx),
    };
  }

  visitArgumentValue(ctx: CstNode): ArgumentValue {
    const children = getChildren(ctx);

    const arrayNode = getNode(children, 'arrayLiteral');
    if (arrayNode) {
      return this.visitArrayLiteral(arrayNode);
    }

    const objectNode = getNode(children, 'objectLiteral');
    if (objectNode) {
      return this.visitObjectLiteral(objectNode);
    }

    const numberToken = getToken(children, 'NumberLiteral');
    if (numberToken) {
      return parseNumberLiteral(numberToken.image);
    }

    const stringToken = getToken(children, 'StringLiteral');
    if (stringToken) {
      return parseStringLiteral(stringToken.image);
    }

    const trueToken = getToken(children, 'True');
    if (trueToken) {
      return true;
    }

    const falseToken = getToken(children, 'False');
    if (falseToken) {
      return false;
    }

    const identToken = getToken(children, 'Identifier');
    if (identToken) {
      // Parameter reference
      return { name: identToken.image, location: tokenLocation(identToken) };
    }

    // Best-effort: return 0 for invalid argument value
    return 0;
  }

  visitArrayLiteral(ctx: CstNode): ArrayLiteral {
    const children = getChildren(ctx);
    const elements: ArgumentValue[] = [];
    for (const valueNode of getAllNodes(children, 'argumentValue')) {
      elements.push(this.visitArgumentValue(valueNode));
    }
    return {
      kind: 'array',
      elements,
      location: nodeLocation(ctx),
    };
  }

  visitObjectLiteral(ctx: CstNode): ObjectLiteral {
    const children = getChildren(ctx);
    const entries: Array<{ key: number; value: ArgumentValue }> = [];
    for (const entryNode of getAllNodes(children, 'objectEntry')) {
      const entryChildren = getChildren(entryNode);
      const keyToken = getToken(entryChildren, 'key')!;
      const valueNode = getNode(entryChildren, 'argumentValue')!;
      entries.push({
        key: parseNumberLiteral(keyToken.image),
        value: this.visitArgumentValue(valueNode),
      });
    }
    return {
      kind: 'object',
      entries,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Connect Statement
  // ==========================================================================

  visitConnectStatement(ctx: CstNode): ConnectionStmt {
    const children = getChildren(ctx);
    const sourceNode = getNode(children, 'source');
    const targetNode = getNode(children, 'target');

    // Best-effort: mark incomplete if missing required parts
    if (!sourceNode || !targetNode) {
      const dummyPortRef: PortRef = {
        nodeId: null,
        portName: '',
        location: nodeLocation(ctx),
      };
      return {
        source: sourceNode ? this.visitPortRef(sourceNode) : dummyPortRef,
        target: targetNode ? this.visitPortRef(targetNode) : dummyPortRef,
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    return {
      source: this.visitPortRef(sourceNode),
      target: this.visitPortRef(targetNode),
      location: nodeLocation(ctx),
    };
  }

  visitPortRef(ctx: CstNode): PortRef {
    const children = getChildren(ctx);
    const firstNode = getNode(children, 'first')!;
    const secondNode = getNode(children, 'second');

    const firstIdent = this.visitPortRefIdentifier(firstNode);

    if (secondNode) {
      const secondIdent = this.visitPortRefIdentifier(secondNode);
      return {
        nodeId: firstIdent,
        portName: secondIdent,
        location: nodeLocation(ctx),
      };
    } else {
      return {
        nodeId: null,
        portName: firstIdent,
        location: nodeLocation(ctx),
      };
    }
  }

  visitPortRefIdentifier(ctx: CstNode): string {
    const children = getChildren(ctx);
    // Check all possible token types that can be used as identifiers
    for (const key of ['Identifier', 'In', 'On', 'Input', 'Output', 'Clock', 'State', 'Node']) {
      const token = getToken(children, key);
      if (token) {
        return token.image;
      }
    }
    // Best-effort: return empty string instead of throwing
    return '';
  }

  // ==========================================================================
  // Behavioral Statements
  // ==========================================================================

  visitOnClockStatement(ctx: CstNode): OnClockStmt {
    const children = getChildren(ctx);
    const clockRefToken = getToken(children, 'clockRef');
    const edgeNode = getNode(children, 'clockEdge');

    // Best-effort: handle missing required parts
    const edge = edgeNode ? this.visitClockEdge(edgeNode) : 'rising';
    const body: Statement[] = [];
    for (const stmtNode of getAllNodes(children, 'statement')) {
      const stmt = this.visitStatement(stmtNode);
      if (stmt) body.push(stmt);
    }

    const isIncomplete = !clockRefToken || !edgeNode;

    return {
      clockEdge: {
        clockRef: clockRefToken?.image ?? '',
        edge,
        location: edgeNode ? nodeLocation(edgeNode) : nodeLocation(ctx),
      },
      body,
      location: nodeLocation(ctx),
      ...(isIncomplete && { isIncomplete: true }),
    };
  }

  visitClockEdge(ctx: CstNode): 'rising' | 'falling' {
    const children = getChildren(ctx);
    if (getToken(children, 'Rising')) return 'rising';
    if (getToken(children, 'Falling')) return 'falling';
    // Best-effort: default to rising instead of throwing
    return 'rising';
  }

  visitStatement(ctx: CstNode): Statement | null {
    const children = getChildren(ctx);
    const conditional = getNode(children, 'conditionalStatement');
    if (conditional) {
      return this.visitConditionalStatement(conditional);
    }
    const assignment = getNode(children, 'assignment');
    if (assignment) {
      return this.visitAssignment(assignment);
    }
    // Best-effort: return null for invalid statements (will be filtered)
    return null;
  }

  visitAssignment(ctx: CstNode): Assignment {
    const children = getChildren(ctx);
    const targetToken = getToken(children, 'target');
    const exprNode = getNode(children, 'expression');

    // Best-effort: handle missing required parts
    if (!targetToken || !exprNode) {
      return {
        target: targetToken?.image ?? '',
        value: exprNode ? this.visitExpression(exprNode) : { value: 0, location: nodeLocation(ctx) },
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    return {
      target: targetToken.image,
      value: this.visitExpression(exprNode),
      location: nodeLocation(ctx),
    };
  }

  visitConditionalStatement(ctx: CstNode): ConditionalStmt {
    const children = getChildren(ctx);
    const conditionNode = getNode(children, 'condition');

    const thenStatements = getAllNodes(children, 'thenBody');
    const elseStatements = getAllNodes(children, 'elseBody');

    const thenBody: Statement[] = [];
    for (const stmtNode of thenStatements) {
      const stmt = this.visitStatement(stmtNode);
      if (stmt) thenBody.push(stmt);
    }

    let elseBody: Statement[] | undefined;
    if (elseStatements.length > 0) {
      elseBody = [];
      for (const stmtNode of elseStatements) {
        const stmt = this.visitStatement(stmtNode);
        if (stmt) elseBody.push(stmt);
      }
    }

    // Best-effort: handle missing condition
    if (!conditionNode) {
      return {
        condition: { value: false, location: nodeLocation(ctx) },
        thenBody,
        elseBody,
        location: nodeLocation(ctx),
        isIncomplete: true,
      };
    }

    return {
      condition: this.visitExpression(conditionNode),
      thenBody,
      elseBody,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Expressions
  // ==========================================================================

  visitExpression(ctx: CstNode): Expr {
    const children = getChildren(ctx);
    const orNode = getNode(children, 'orExpression')!;
    return this.visitOrExpression(orNode);
  }

  visitOrExpression(ctx: CstNode): Expr {
    return this.visitBinaryExpr(ctx, 'xorExpression', 'Pipe', '|');
  }

  visitXorExpression(ctx: CstNode): Expr {
    return this.visitBinaryExpr(ctx, 'andExpression', 'Caret', '^');
  }

  visitAndExpression(ctx: CstNode): Expr {
    return this.visitBinaryExpr(ctx, 'equalityExpression', 'Ampersand', '&');
  }

  visitEqualityExpression(ctx: CstNode): Expr {
    return this.visitBinaryExprMultiOp(ctx, 'relationalExpression', ['Eq', 'Ne']);
  }

  visitRelationalExpression(ctx: CstNode): Expr {
    return this.visitBinaryExprMultiOp(ctx, 'additiveExpression', ['Lt', 'Gt', 'Le', 'Ge']);
  }

  visitAdditiveExpression(ctx: CstNode): Expr {
    return this.visitBinaryExprMultiOp(ctx, 'multiplicativeExpression', ['Plus', 'Minus']);
  }

  visitMultiplicativeExpression(ctx: CstNode): Expr {
    return this.visitBinaryExprMultiOp(ctx, 'unaryExpression', ['Star', 'Slash']);
  }

  private visitBinaryExpr(
    ctx: CstNode,
    childRuleName: string,
    _operatorName: string,
    operatorStr: string
  ): Expr {
    const children = getChildren(ctx);
    const lhsNode = getNode(children, 'lhs')!;
    const rhsNodes = getAllNodes(children, 'rhs');

    let left = this.dispatchVisitor(childRuleName, lhsNode);

    for (const rhsNode of rhsNodes) {
      const right = this.dispatchVisitor(childRuleName, rhsNode);
      left = {
        operator: operatorStr as '+' | '-' | '*' | '/' | '&' | '|' | '^' | '==' | '!=' | '<' | '>' | '<=' | '>=',
        left,
        right,
        location: createRange(left.location.start, right.location.end),
      };
    }

    return left;
  }

  private visitBinaryExprMultiOp(ctx: CstNode, childRuleName: string, operatorNames: string[]): Expr {
    const children = getChildren(ctx);
    const lhsNode = getNode(children, 'lhs')!;
    const rhsNodes = getAllNodes(children, 'rhs');

    // Collect all operator tokens
    const opTokens: IToken[] = [];
    for (const opName of operatorNames) {
      opTokens.push(...getAllTokens(children, opName));
    }
    // Sort by offset
    opTokens.sort((a, b) => a.startOffset - b.startOffset);

    let left = this.dispatchVisitor(childRuleName, lhsNode);

    for (let i = 0; i < rhsNodes.length; i++) {
      const right = this.dispatchVisitor(childRuleName, rhsNodes[i]);
      const opToken = opTokens[i];
      const opStr = tokenTypeToOperator(opToken?.tokenType?.name ?? '');
      // Best-effort: default to '+' if unknown operator
      const operator = opStr || '+';

      left = {
        operator: operator as '+' | '-' | '*' | '/' | '&' | '|' | '^' | '==' | '!=' | '<' | '>' | '<=' | '>=',
        left,
        right,
        location: createRange(left.location.start, right.location.end),
      };
    }

    return left;
  }

  private dispatchVisitor(ruleName: string, node: CstNode): Expr {
    switch (ruleName) {
      case 'xorExpression':
        return this.visitXorExpression(node);
      case 'andExpression':
        return this.visitAndExpression(node);
      case 'equalityExpression':
        return this.visitEqualityExpression(node);
      case 'relationalExpression':
        return this.visitRelationalExpression(node);
      case 'additiveExpression':
        return this.visitAdditiveExpression(node);
      case 'multiplicativeExpression':
        return this.visitMultiplicativeExpression(node);
      case 'unaryExpression':
        return this.visitUnaryExpression(node);
      default:
        // Best-effort: return literal 0 for unknown rule
        return { value: 0, location: nodeLocation(node) };
    }
  }

  visitUnaryExpression(ctx: CstNode): Expr {
    const children = getChildren(ctx);

    // Check for unary operators
    const bangToken = getToken(children, 'Bang');
    const tildeToken = getToken(children, 'Tilde');
    const minusToken = getToken(children, 'Minus');

    const operandNode = getNode(children, 'operand');
    if (operandNode && (bangToken || tildeToken || minusToken)) {
      const opToken = bangToken || tildeToken || minusToken;
      const opStr = tokenTypeToOperator(opToken!.tokenType?.name ?? '') || '!';
      const operand = this.visitUnaryExpression(operandNode);
      return {
        operator: opStr as '!' | '~' | '-',
        operand,
        location: createRange(tokenLocation(opToken!).start, operand.location.end),
      };
    }

    const primaryNode = getNode(children, 'primaryExpression');
    if (primaryNode) {
      return this.visitPrimaryExpression(primaryNode);
    }

    // Best-effort: return literal 0 for invalid unary expression
    return { value: 0, location: nodeLocation(ctx) };
  }

  visitPrimaryExpression(ctx: CstNode): Expr {
    const children = getChildren(ctx);

    const numberToken = getToken(children, 'NumberLiteral');
    if (numberToken) {
      return {
        value: parseNumberLiteral(numberToken.image),
        location: tokenLocation(numberToken),
      };
    }

    const stringToken = getToken(children, 'StringLiteral');
    if (stringToken) {
      return {
        value: parseStringLiteral(stringToken.image),
        location: tokenLocation(stringToken),
      };
    }

    const trueToken = getToken(children, 'True');
    if (trueToken) {
      return { value: true, location: tokenLocation(trueToken) };
    }

    const falseToken = getToken(children, 'False');
    if (falseToken) {
      return { value: false, location: tokenLocation(falseToken) };
    }

    const identToken = getToken(children, 'Identifier');
    if (identToken) {
      return { name: identToken.image, location: tokenLocation(identToken) };
    }

    const exprNode = getNode(children, 'expression');
    if (exprNode) {
      return this.visitExpression(exprNode);
    }

    // Best-effort: return literal 0 for invalid primary expression
    return { value: 0, location: nodeLocation(ctx) };
  }

  // ==========================================================================
  // Literals
  // ==========================================================================

  visitLiteral(ctx: CstNode): number | string | boolean {
    const children = getChildren(ctx);

    const numberToken = getToken(children, 'NumberLiteral');
    if (numberToken) {
      return parseNumberLiteral(numberToken.image);
    }

    const stringToken = getToken(children, 'StringLiteral');
    if (stringToken) {
      return parseStringLiteral(stringToken.image);
    }

    const trueToken = getToken(children, 'True');
    if (trueToken) {
      return true;
    }

    const falseToken = getToken(children, 'False');
    if (falseToken) {
      return false;
    }

    // Best-effort: return 0 for invalid literal
    return 0;
  }

  // ==========================================================================
  // Testbench Definition
  // ==========================================================================

  visitTestbenchDefinition(ctx: CstNode): TestbenchDef {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const circuitRefNode = getNode(children, 'circuitRef')!;

    const inputs: TestInputDecl[] = [];
    const outputs: TestOutputDecl[] = [];
    const clocks: TestClockDecl[] = [];

    for (const inputNode of getAllNodes(children, 'testInputDeclaration')) {
      inputs.push(this.visitTestInputDeclaration(inputNode));
    }
    for (const outputNode of getAllNodes(children, 'testOutputDeclaration')) {
      outputs.push(this.visitTestOutputDeclaration(outputNode));
    }
    for (const clockNode of getAllNodes(children, 'testClockDeclaration')) {
      clocks.push(this.visitTestClockDeclaration(clockNode));
    }

    const implNode = getNode(children, 'testImplBlock');
    const impl = implNode ? this.visitTestImplBlock(implNode) : undefined;

    return {
      name: nameToken.image,
      circuitRef: this.visitCircuitRef(circuitRefNode),
      inputs,
      outputs,
      clocks,
      impl,
      location: nodeLocation(ctx),
    };
  }

  visitCircuitRef(ctx: CstNode): CircuitRef {
    const children = getChildren(ctx);
    const circuitNameToken = getToken(children, 'circuitName')!;
    const instanceNameToken = getToken(children, 'instanceName')!;

    return {
      circuitName: circuitNameToken.image,
      instanceName: instanceNameToken.image,
      location: nodeLocation(ctx),
    };
  }

  visitTestInputDeclaration(ctx: CstNode): TestInputDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const typeNode = getNode(children, 'testTypeExpr')!;
    const { portType, width } = this.visitTestTypeExpr(typeNode);

    return {
      name: nameToken.image,
      portType,
      width,
      location: nodeLocation(ctx),
    };
  }

  visitTestOutputDeclaration(ctx: CstNode): TestOutputDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const typeNode = getNode(children, 'testTypeExpr')!;
    const { portType, width } = this.visitTestTypeExpr(typeNode);

    return {
      name: nameToken.image,
      portType,
      width,
      location: nodeLocation(ctx),
    };
  }

  visitTestClockDeclaration(ctx: CstNode): TestClockDecl {
    const children = getChildren(ctx);
    const nameToken = getToken(children, 'name')!;
    const freqNode = getNode(children, 'frequencyExpr');

    return {
      name: nameToken.image,
      frequency: freqNode ? this.visitFrequencyExpr(freqNode) : undefined,
      location: nodeLocation(ctx),
    };
  }

  visitTestTypeExpr(ctx: CstNode): { portType: 'Bit' | 'Bus'; width?: number } {
    const children = getChildren(ctx);
    if (getToken(children, 'Bit')) {
      return { portType: 'Bit' };
    }
    if (getToken(children, 'Bus')) {
      const numberToken = getToken(children, 'NumberLiteral');
      return { portType: 'Bus', width: numberToken ? parseNumberLiteral(numberToken.image) : 1 };
    }
    // Best-effort: return Bit as default
    return { portType: 'Bit' };
  }

  visitFrequencyExpr(ctx: CstNode): FrequencyExpr {
    const children = getChildren(ctx);
    const valueToken = getToken(children, 'value');
    const unitToken = getToken(children, 'unit');

    const unitStr = unitToken?.image.toLowerCase() ?? 'hz';
    let unit: 'Hz' | 'kHz' | 'MHz' | 'GHz';
    if (unitStr === 'hz') unit = 'Hz';
    else if (unitStr === 'khz') unit = 'kHz';
    else if (unitStr === 'mhz') unit = 'MHz';
    else if (unitStr === 'ghz') unit = 'GHz';
    else unit = 'Hz'; // Best-effort default

    return {
      value: valueToken ? parseNumberLiteral(valueToken.image) : 1,
      unit,
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Testbench Implementation
  // ==========================================================================

  visitTestImplBlock(ctx: CstNode): TestImplBlock {
    const children = getChildren(ctx);
    const nodes: TestNodeDecl[] = [];
    const connections: TestConnectionStmt[] = [];
    const stimulus: StimulusBlock[] = [];
    const assertions: AssertBlock[] = [];
    let capture: CaptureBlock | undefined;

    for (const itemNode of getAllNodes(children, 'testImplItem')) {
      const itemChildren = getChildren(itemNode);
      const nodeDecl = getNode(itemChildren, 'testNodeDeclaration');
      if (nodeDecl) {
        nodes.push(this.visitTestNodeDeclaration(nodeDecl));
        continue;
      }
      const connectStmt = getNode(itemChildren, 'testConnectStatement');
      if (connectStmt) {
        connections.push(this.visitTestConnectStatement(connectStmt));
        continue;
      }
      const stimulusBlock = getNode(itemChildren, 'stimulusBlock');
      if (stimulusBlock) {
        stimulus.push(this.visitStimulusBlock(stimulusBlock));
        continue;
      }
      const captureBlock = getNode(itemChildren, 'captureBlock');
      if (captureBlock) {
        capture = this.visitCaptureBlock(captureBlock);
        continue;
      }
      const assertBlock = getNode(itemChildren, 'assertBlock');
      if (assertBlock) {
        assertions.push(this.visitAssertBlock(assertBlock));
        continue;
      }
    }

    return {
      nodes,
      connections,
      stimulus: stimulus.length > 0 ? stimulus : undefined,
      capture,
      assertions: assertions.length > 0 ? assertions : undefined,
      location: nodeLocation(ctx),
    };
  }

  visitTestNodeDeclaration(ctx: CstNode): TestNodeDecl {
    const children = getChildren(ctx);
    const instanceNameToken = getToken(children, 'instanceName')!;
    const componentTypeToken = getToken(children, 'componentType')!;

    return {
      instanceName: instanceNameToken.image,
      componentType: componentTypeToken.image,
      location: nodeLocation(ctx),
    };
  }

  visitTestConnectStatement(ctx: CstNode): TestConnectionStmt {
    const children = getChildren(ctx);
    const sourceNode = getNode(children, 'source')!;
    const targetNode = getNode(children, 'target')!;

    return {
      source: this.visitPortRef(sourceNode),
      target: this.visitPortRef(targetNode),
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Stimulus Block
  // ==========================================================================

  visitStimulusBlock(ctx: CstNode): StimulusBlock {
    const children = getChildren(ctx);
    const clockRefToken = getToken(children, 'clockRef')!;
    const events: StimulusEvent[] = [];

    for (const eventNode of getAllNodes(children, 'stimulusEvent')) {
      events.push(this.visitStimulusEvent(eventNode));
    }

    return {
      clockRef: clockRefToken.image,
      events,
      location: nodeLocation(ctx),
    };
  }

  visitStimulusEvent(ctx: CstNode): StimulusEvent {
    const children = getChildren(ctx);
    const timingNode = getNode(children, 'stimulusTiming')!;
    const assignments: StimulusAssignment[] = [];

    for (const assignNode of getAllNodes(children, 'stimulusAssignment')) {
      assignments.push(this.visitStimulusAssignment(assignNode));
    }

    return {
      timing: this.visitStimulusTiming(timingNode),
      assignments,
      location: nodeLocation(ctx),
    };
  }

  visitStimulusTiming(ctx: CstNode): StimulusTiming {
    const children = getChildren(ctx);
    const startNode = getNode(children, 'start')!;
    const endNode = getNode(children, 'end');
    const stepToken = getToken(children, 'step');

    const startExpr = this.visitExpression(startNode);

    if (!endNode) {
      return {
        kind: 'single',
        cycle: startExpr,
        location: nodeLocation(ctx),
      };
    }

    const endExpr = this.visitExpression(endNode);

    if (stepToken) {
      return {
        kind: 'stepped',
        start: startExpr,
        end: endExpr,
        step: parseNumberLiteral(stepToken.image),
        location: nodeLocation(ctx),
      };
    }

    return {
      kind: 'range',
      start: startExpr,
      end: endExpr,
      location: nodeLocation(ctx),
    };
  }

  visitStimulusAssignment(ctx: CstNode): StimulusAssignment {
    const children = getChildren(ctx);
    const signalToken = getToken(children, 'signal')!;
    const valueNode = getNode(children, 'value')!;

    return {
      signal: signalToken.image,
      value: this.visitExpression(valueNode),
      location: nodeLocation(ctx),
    };
  }

  // ==========================================================================
  // Capture Block
  // ==========================================================================

  visitCaptureBlock(ctx: CstNode): CaptureBlock {
    const children = getChildren(ctx);
    let signals: string[] = [];
    let format: 'vcd' = 'vcd';
    let filename = '';

    for (const itemNode of getAllNodes(children, 'captureItem')) {
      const itemChildren = getChildren(itemNode);
      const signalsDecl = getNode(itemChildren, 'signalsDeclaration');
      if (signalsDecl) {
        signals = this.visitSignalsDeclaration(signalsDecl);
        continue;
      }
      const formatDecl = getNode(itemChildren, 'formatDeclaration');
      if (formatDecl) {
        const formatChildren = getChildren(formatDecl);
        const formatToken = getToken(formatChildren, 'Identifier')!;
        if (formatToken.image !== 'vcd') {
          throw new Error(`Unsupported format: ${formatToken.image}. Only 'vcd' is supported`);
        }
        format = 'vcd';
        continue;
      }
      const filenameDecl = getNode(itemChildren, 'filenameDeclaration');
      if (filenameDecl) {
        const filenameChildren = getChildren(filenameDecl);
        const filenameToken = getToken(filenameChildren, 'StringLiteral')!;
        filename = parseStringLiteral(filenameToken.image);
        continue;
      }
    }

    return {
      signals,
      format,
      filename,
      location: nodeLocation(ctx),
    };
  }

  visitSignalsDeclaration(ctx: CstNode): string[] {
    const children = getChildren(ctx);
    const signals: string[] = [];
    for (const token of getAllTokens(children, 'Identifier')) {
      signals.push(token.image);
    }
    return signals;
  }

  // ==========================================================================
  // Assert Block
  // ==========================================================================

  visitAssertBlock(ctx: CstNode): AssertBlock {
    const children = getChildren(ctx);
    const clockRefToken = getToken(children, 'clockRef')!;
    const assertions: Assertion[] = [];

    for (const itemNode of getAllNodes(children, 'assertionItem')) {
      assertions.push(this.visitAssertionItem(itemNode));
    }

    return {
      clockRef: clockRefToken.image,
      assertions,
      location: nodeLocation(ctx),
    };
  }

  visitAssertionItem(ctx: CstNode): Assertion {
    const children = getChildren(ctx);
    const timingNode = getNode(children, 'stimulusTiming')!;
    const conditionNode = getNode(children, 'condition')!;
    const messageToken = getToken(children, 'message');

    return {
      timing: this.visitStimulusTiming(timingNode),
      condition: this.visitExpression(conditionNode),
      message: messageToken ? parseStringLiteral(messageToken.image) : undefined,
      location: nodeLocation(ctx),
    };
  }
}

// Singleton visitor instance
export const visitor = new CstToAstVisitor();
