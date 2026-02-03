/**
 * DSL Parser
 *
 * Converts a stream of tokens into an Abstract Syntax Tree (AST).
 *
 * Grammar (simplified):
 *
 * program          → circuit_def*
 * circuit_def      → 'component' IDENTIFIER parameters? '{' circuit_body '}'
 * parameters       → '(' param_decl (',' param_decl)* ')'
 * param_decl       → IDENTIFIER ':' param_type ('=' literal)?
 * circuit_body     → (port_decl | state_decl | impl_block)*
 * port_decl        → ('input' | 'output') IDENTIFIER ':' type_expr
 *                  | 'clock' IDENTIFIER
 * state_decl       → 'state' IDENTIFIER ':' type_expr ('=' literal)?
 * impl_block       → 'impl' '{' impl_body '}'
 * impl_body        → (node_decl | connect_stmt | on_clock_stmt)*
 * node_decl        → 'node' IDENTIFIER ':' IDENTIFIER arguments?
 * arguments        → '(' argument (',' argument)* ')'
 * argument         → IDENTIFIER '=' value
 * connect_stmt     → 'connect' port_ref '->' port_ref
 * port_ref         → IDENTIFIER ('.' IDENTIFIER)?
 * type_expr        → 'Bit' | 'Bus' '[' NUMBER ']'
 */

import {
  ASTNode,
  Program,
  CircuitDef,
  ParameterDecl,
  InputDecl,
  OutputDecl,
  ClockDecl,
  StateDecl,
  ImplBlock,
  NodeDecl,
  ConnectionStmt,
  PortRef,
  TypeExpr,
  BitTypeExpr,
  BusTypeExpr,
  Argument,
  ArgumentValue,
  ArrayLiteral,
  ObjectLiteral,
  ParameterRef,
  OnClockStmt,
  ClockEdge,
  Statement,
  Assignment,
  ConditionalStmt,
  Expr,
  LiteralExpr,
  VariableExpr,
  BinaryExpr,
  UnaryExpr,
  createRange,
  StateTypeExpr,
  MemoryTypeExpr,
} from '../types/ast';
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
  SingleCycleTiming,
  RangeTiming,
  SteppedTiming,
  StimulusAssignment,
  CaptureBlock,
  FrequencyExpr,
} from '../types/testbench-ast';
import { Token, TokenType, isBinaryOperator, isUnaryOperator, getOperatorPrecedence, tokenTypeToOperator } from './token';

// ============================================================================
// Parser Error
// ============================================================================

export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// ============================================================================
// Parser
// ============================================================================

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the entire program
   */
  public parse(): Program {
    const circuits: CircuitDef[] = [];
    const testbenches: TestbenchDef[] = [];

    while (!this.isAtEnd()) {
      if (this.check(TokenType.CIRCUIT)) {
        circuits.push(this.parseCircuitDef());
      } else if (this.check(TokenType.TESTBENCH)) {
        testbenches.push(this.parseTestbenchDef());
      } else {
        throw new ParseError(
          `Expected 'circuit' or 'testbench', got ${this.peek().type}`,
          this.peek()
        );
      }
    }

    return {
      circuits,
      testbenches: testbenches.length > 0 ? testbenches : undefined,
      location: this.createProgramRange(),
    };
  }

  // ==========================================================================
  // Circuit Definition
  // ==========================================================================

  private parseCircuitDef(): CircuitDef {
    const start = this.peek();
    this.consume(TokenType.CIRCUIT, "Expected 'circuit'");
    const name = this.consume(TokenType.IDENTIFIER, 'Expected circuit name').value;

    const parameters = this.match(TokenType.LPAREN) ? this.parseParameters() : [];

    this.consume(TokenType.LBRACE, "Expected '{'");

    const inputs: InputDecl[] = [];
    const outputs: OutputDecl[] = [];
    const clocks: ClockDecl[] = [];
    const state: StateDecl[] = [];
    let impl: ImplBlock | undefined = undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.INPUT)) {
        inputs.push(this.parseInputDecl());
      } else if (this.match(TokenType.OUTPUT)) {
        outputs.push(this.parseOutputDecl());
      } else if (this.match(TokenType.CLOCK)) {
        clocks.push(this.parseClockDecl());
      } else if (this.match(TokenType.STATE)) {
        state.push(this.parseStateDecl());
      } else if (this.check(TokenType.IMPL)) {
        if (impl !== undefined) {
          throw new ParseError('Multiple impl blocks not allowed', this.peek());
        }
        impl = this.parseImplBlock();
      } else {
        throw new ParseError(
          `Unexpected token in circuit body: ${this.peek().type}`,
          this.peek()
        );
      }
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      name,
      parameters,
      inputs,
      outputs,
      clocks,
      state,
      impl,
      location: createRange(start.location.start, end.location.end),
    };
  }

  // ==========================================================================
  // Parameters
  // ==========================================================================

  private parseParameters(): ParameterDecl[] {
    const parameters: ParameterDecl[] = [];

    do {
      parameters.push(this.parseParameterDecl());
    } while (this.match(TokenType.COMMA));

    this.consume(TokenType.RPAREN, "Expected ')'");
    return parameters;
  }

  private parseParameterDecl(): ParameterDecl {
    const start = this.peek();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
    this.consume(TokenType.COLON, "Expected ':'");
    const paramType = this.parseParameterType();

    let defaultValue: number | string | boolean | undefined = undefined;
    if (this.match(TokenType.ASSIGN)) {
      const valueToken = this.advance();
      if (valueToken.type === TokenType.NUMBER) {
        defaultValue = valueToken.numberValue!;
      } else if (valueToken.type === TokenType.STRING) {
        defaultValue = valueToken.stringValue!;
      } else if (valueToken.type === TokenType.TRUE) {
        defaultValue = true;
      } else if (valueToken.type === TokenType.FALSE) {
        defaultValue = false;
      } else {
        throw new ParseError('Expected literal value for default parameter', valueToken);
      }
    }

    return {
      name,
      paramType,
      defaultValue,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseParameterType(): 'int' | 'string' | 'bool' {
    const token = this.advance();
    if (token.type === TokenType.IDENTIFIER) {
      if (token.value === 'Int' || token.value === 'int') return 'int';
      if (token.value === 'String' || token.value === 'string') return 'string';
      if (token.value === 'Bool' || token.value === 'bool') return 'bool';
    }
    throw new ParseError('Expected parameter type (Int, String, or Bool)', token);
  }

  // ==========================================================================
  // Port Declarations
  // ==========================================================================

  private parseInputDecl(): InputDecl {
    const start = this.previous(); // 'input' already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected input name').value;
    this.consume(TokenType.COLON, "Expected ':'");
    const portType = this.parseTypeExpr();

    return {
      name,
      portType,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseOutputDecl(): OutputDecl {
    const start = this.previous(); // 'output' already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected output name').value;
    this.consume(TokenType.COLON, "Expected ':'");
    const portType = this.parseTypeExpr();

    return {
      name,
      portType,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseClockDecl(): ClockDecl {
    const start = this.previous(); // 'clock' already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected clock name').value;

    return {
      name,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  // ==========================================================================
  // State Declarations
  // ==========================================================================

  private parseStateDecl(): StateDecl {
    const start = this.previous(); // 'state' already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected state variable name').value;
    this.consume(TokenType.COLON, "Expected ':'");
    const stateType = this.parseStateTypeExpr();

    let initialValue: number | string | boolean | undefined = undefined;
    if (this.match(TokenType.ASSIGN)) {
      const valueToken = this.advance();
      if (valueToken.type === TokenType.NUMBER) {
        initialValue = valueToken.numberValue!;
      } else if (valueToken.type === TokenType.STRING) {
        initialValue = valueToken.stringValue!;
      } else if (valueToken.type === TokenType.TRUE) {
        initialValue = true;
      } else if (valueToken.type === TokenType.FALSE) {
        initialValue = false;
      } else {
        throw new ParseError('Expected literal value for initial state', valueToken);
      }
    }

    return {
      name,
      stateType,
      initialValue,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  // ==========================================================================
  // Type Expressions
  // ==========================================================================

  private parseTypeExpr(): TypeExpr {
    const start = this.peek();

    if (this.match(TokenType.BIT)) {
      return {
        kind: 'bit',
        location: createRange(start.location.start, this.previous().location.end),
      };
    }

    if (this.match(TokenType.BUS) || this.match(TokenType.WORD)) {
      this.consume(TokenType.LBRACKET, "Expected '['");
      const width = this.parseWidthExpr();
      this.consume(TokenType.RBRACKET, "Expected ']'");

      return {
        kind: 'bus',
        width,
        location: createRange(start.location.start, this.previous().location.end),
      };
    }

    throw new ParseError('Expected type expression (Bit or Bus[N])', start);
  }

  private parseStateTypeExpr(): StateTypeExpr {
    const start = this.peek();

    // Check for Array (memory)
    if (this.match(TokenType.ARRAY)) {
      this.consume(TokenType.LBRACKET, "Expected '['");

      // Parse size (2^addressWidth)
      const sizeToken = this.advance();
      let addressWidth: number;

      if (sizeToken.type === TokenType.NUMBER) {
        // Direct size or expression like 2^8
        addressWidth = Math.log2(sizeToken.numberValue!);
        if (!Number.isInteger(addressWidth)) {
          throw new ParseError('Array size must be a power of 2', sizeToken);
        }
      } else {
        throw new ParseError('Expected array size', sizeToken);
      }

      this.consume(TokenType.COMMA, "Expected ','");

      // Parse element type
      const elementType = this.parseTypeExpr();
      let dataWidth: number;

      if (elementType.kind === 'bit') {
        dataWidth = 1;
      } else if (elementType.kind === 'bus') {
        if (typeof elementType.width === 'number') {
          dataWidth = elementType.width;
        } else {
          throw new ParseError('Memory data width must be a constant', start);
        }
      } else {
        throw new ParseError('Invalid memory element type', start);
      }

      this.consume(TokenType.RBRACKET, "Expected ']'");

      const memType: MemoryTypeExpr = {
        kind: 'memory',
        addressWidth,
        dataWidth,
        location: createRange(start.location.start, this.previous().location.end),
      };
      return memType;
    }

    // Otherwise parse as regular type
    return this.parseTypeExpr();
  }

  private parseWidthExpr(): number | ParameterRef {
    const token = this.advance();

    if (token.type === TokenType.NUMBER) {
      return token.numberValue!;
    }

    if (token.type === TokenType.IDENTIFIER) {
      return {
        name: token.value,
        location: token.location,
      };
    }

    throw new ParseError('Expected number or parameter name for bus width', token);
  }

  // ==========================================================================
  // Implementation Block
  // ==========================================================================

  private parseImplBlock(): ImplBlock {
    const start = this.consume(TokenType.IMPL, "Expected 'impl'");
    this.consume(TokenType.LBRACE, "Expected '{'");

    const nodes: NodeDecl[] = [];
    const connections: ConnectionStmt[] = [];
    const statements: Statement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.NODE)) {
        nodes.push(this.parseNodeDecl());
      } else if (this.match(TokenType.CONNECT)) {
        connections.push(this.parseConnectionStmt());
      } else if (this.match(TokenType.ON)) {
        statements.push(this.parseOnClockStmt());
      } else if (this.check(TokenType.IDENTIFIER)) {
        // Could be an assignment
        statements.push(this.parseAssignment());
      } else {
        throw new ParseError(
          `Unexpected token in impl block: ${this.peek().type}`,
          this.peek()
        );
      }
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      nodes,
      connections,
      statements,
      location: createRange(start.location.start, end.location.end),
    };
  }

  // ==========================================================================
  // Node Declaration
  // ==========================================================================

  private parseNodeDecl(): NodeDecl {
    const start = this.previous(); // 'node' already consumed
    const instanceName = this.consume(TokenType.IDENTIFIER, 'Expected node instance name').value;
    this.consume(TokenType.COLON, "Expected ':'");
    const componentType = this.consume(TokenType.IDENTIFIER, 'Expected circuit type').value;

    const args = this.match(TokenType.LPAREN) ? this.parseArguments() : [];

    return {
      instanceName,
      componentType,
      arguments: args,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseArguments(): Argument[] {
    const args: Argument[] = [];

    do {
      args.push(this.parseArgument());
    } while (this.match(TokenType.COMMA));

    this.consume(TokenType.RPAREN, "Expected ')'");
    return args;
  }

  private parseArgument(): Argument {
    const start = this.peek();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected argument name').value;
    this.consume(TokenType.ASSIGN, "Expected '='");

    const value = this.parseArgumentValue();

    return {
      name,
      value,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseArgumentValue(): ArgumentValue {
    const token = this.peek();

    // Array literal: [1, 2, 3]
    if (token.type === TokenType.LBRACKET) {
      return this.parseArrayLiteral();
    }

    // Object literal: {64: 3, 65: 4}
    if (token.type === TokenType.LBRACE) {
      return this.parseObjectLiteral();
    }

    // Simple values
    const valueToken = this.advance();

    if (valueToken.type === TokenType.NUMBER) {
      return valueToken.numberValue!;
    } else if (valueToken.type === TokenType.STRING) {
      return valueToken.stringValue!;
    } else if (valueToken.type === TokenType.TRUE) {
      return true;
    } else if (valueToken.type === TokenType.FALSE) {
      return false;
    } else if (valueToken.type === TokenType.IDENTIFIER) {
      // Parameter reference
      return {
        name: valueToken.value,
        location: valueToken.location,
      };
    } else {
      throw new ParseError('Expected argument value (number, string, bool, array, object, or parameter)', valueToken);
    }
  }

  private parseArrayLiteral(): ArgumentValue {
    const start = this.consume(TokenType.LBRACKET, "Expected '['");
    const elements: ArgumentValue[] = [];

    // Handle empty array
    if (this.check(TokenType.RBRACKET)) {
      const end = this.advance();
      return {
        kind: 'array',
        elements,
        location: createRange(start.location.start, end.location.end),
      };
    }

    // Parse elements
    do {
      elements.push(this.parseArgumentValue());
    } while (this.match(TokenType.COMMA));

    const end = this.consume(TokenType.RBRACKET, "Expected ']'");

    return {
      kind: 'array',
      elements,
      location: createRange(start.location.start, end.location.end),
    };
  }

  private parseObjectLiteral(): ArgumentValue {
    const start = this.consume(TokenType.LBRACE, "Expected '{'");
    const entries: Array<{ key: number; value: ArgumentValue }> = [];

    // Handle empty object
    if (this.check(TokenType.RBRACE)) {
      const end = this.advance();
      return {
        kind: 'object',
        entries,
        location: createRange(start.location.start, end.location.end),
      };
    }

    // Parse entries (key: value pairs)
    do {
      const keyToken = this.consume(TokenType.NUMBER, 'Expected number key for object literal');
      const key = keyToken.numberValue!;
      this.consume(TokenType.COLON, "Expected ':'");
      const value = this.parseArgumentValue();
      entries.push({ key, value });
    } while (this.match(TokenType.COMMA));

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      kind: 'object',
      entries,
      location: createRange(start.location.start, end.location.end),
    };
  }

  // ==========================================================================
  // Connection Statement
  // ==========================================================================

  private parseConnectionStmt(): ConnectionStmt {
    const start = this.previous(); // 'connect' already consumed
    const source = this.parsePortRef();
    this.consume(TokenType.ARROW, "Expected '->'");
    const target = this.parsePortRef();

    return {
      source,
      target,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parsePortRef(): PortRef {
    const start = this.peek();
    const firstIdent = this.consumeIdentifier('Expected port reference');

    if (this.match(TokenType.DOT)) {
      // Node port: node.port
      const portName = this.consumeIdentifier('Expected port name');
      return {
        nodeId: firstIdent,
        portName,
        location: createRange(start.location.start, this.previous().location.end),
      };
    } else {
      // Circuit-level port
      return {
        nodeId: null,
        portName: firstIdent,
        location: createRange(start.location.start, this.previous().location.end),
      };
    }
  }

  // ==========================================================================
  // Behavioral Statements
  // ==========================================================================

  private parseOnClockStmt(): OnClockStmt {
    const start = this.previous(); // 'on' already consumed
    const clockRef = this.consume(TokenType.IDENTIFIER, 'Expected clock name').value;

    let edge: 'rising' | 'falling';
    if (this.match(TokenType.RISING)) {
      edge = 'rising';
    } else if (this.match(TokenType.FALLING)) {
      edge = 'falling';
    } else {
      throw new ParseError("Expected 'rising' or 'falling'", this.peek());
    }

    this.consume(TokenType.LBRACE, "Expected '{'");

    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      clockEdge: {
        clockRef,
        edge,
        location: createRange(start.location.start, this.previous().location.end),
      },
      body,
      location: createRange(start.location.start, end.location.end),
    };
  }

  private parseStatement(): Statement {
    if (this.match(TokenType.IF)) {
      return this.parseConditional();
    }

    // Default: assignment
    return this.parseAssignment();
  }

  private parseAssignment(): Assignment {
    const start = this.peek();
    const target = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;
    this.consume(TokenType.ASSIGN, "Expected '='");
    const value = this.parseExpression();

    return {
      target,
      value,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseConditional(): ConditionalStmt {
    const start = this.previous(); // 'if' already consumed
    const condition = this.parseExpression();

    this.consume(TokenType.LBRACE, "Expected '{'");
    const thenBody: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      thenBody.push(this.parseStatement());
    }
    this.consume(TokenType.RBRACE, "Expected '}'");

    let elseBody: Statement[] | undefined = undefined;
    if (this.match(TokenType.ELSE)) {
      this.consume(TokenType.LBRACE, "Expected '{'");
      elseBody = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        elseBody.push(this.parseStatement());
      }
      this.consume(TokenType.RBRACE, "Expected '}'");
    }

    return {
      condition,
      thenBody,
      elseBody,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  // ==========================================================================
  // Expressions
  // ==========================================================================

  private parseExpression(): Expr {
    return this.parseBinaryExpression(0);
  }

  private parseBinaryExpression(minPrecedence: number): Expr {
    let left = this.parseUnaryExpression();

    while (isBinaryOperator(this.peek().type)) {
      const precedence = getOperatorPrecedence(this.peek().type);
      if (precedence < minPrecedence) break;

      const operatorToken = this.advance();
      const operator = tokenTypeToOperator(operatorToken.type);
      if (!operator) {
        throw new ParseError('Invalid operator', operatorToken);
      }

      const right = this.parseBinaryExpression(precedence + 1);

      left = {
        operator: operator as '+' | '-' | '*' | '/' | '&' | '|' | '^' | '==' | '!=' | '<' | '>' | '<=' | '>=',
        left,
        right,
        location: createRange(left.location.start, right.location.end),
      };
    }

    return left;
  }

  private parseUnaryExpression(): Expr {
    if (isUnaryOperator(this.peek().type)) {
      const start = this.peek();
      const operatorToken = this.advance();
      const operator = tokenTypeToOperator(operatorToken.type);
      if (!operator) {
        throw new ParseError('Invalid unary operator', operatorToken);
      }

      const operand = this.parseUnaryExpression();

      return {
        operator: operator as '!' | '-' | '~',
        operand,
        location: createRange(start.location.start, operand.location.end),
      };
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): Expr {
    const token = this.advance();

    // Literals
    if (token.type === TokenType.NUMBER) {
      return {
        value: token.numberValue!,
        location: token.location,
      };
    }

    if (token.type === TokenType.STRING) {
      return {
        value: token.stringValue!,
        location: token.location,
      };
    }

    if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
      return {
        value: token.boolValue!,
        location: token.location,
      };
    }

    // Variables
    if (token.type === TokenType.IDENTIFIER) {
      return {
        name: token.value,
        location: token.location,
      };
    }

    // Parenthesized expressions
    if (token.type === TokenType.LPAREN) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expected ')'");
      return expr;
    }

    throw new ParseError('Expected expression', token);
  }

  // ==========================================================================
  // Testbench Definition (Phase 1)
  // ==========================================================================

  private parseTestbenchDef(): TestbenchDef {
    const start = this.peek();
    this.consume(TokenType.TESTBENCH, "Expected 'testbench'");
    const name = this.consume(TokenType.IDENTIFIER, 'Expected testbench name').value;

    this.consume(TokenType.LBRACE, "Expected '{'");

    // Parse circuit reference: use circuit MiniSwitch2Port as dut
    let circuitRef: CircuitRef | undefined = undefined;
    if (this.match(TokenType.USE)) {
      circuitRef = this.parseCircuitRef();
    }

    if (!circuitRef) {
      throw new ParseError('Testbench must have "use circuit ... as ..." declaration', this.peek());
    }

    const inputs: TestInputDecl[] = [];
    const outputs: TestOutputDecl[] = [];
    const clocks: TestClockDecl[] = [];
    let impl: TestImplBlock | undefined = undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.INPUT)) {
        inputs.push(this.parseTestInputDecl());
      } else if (this.match(TokenType.OUTPUT)) {
        outputs.push(this.parseTestOutputDecl());
      } else if (this.match(TokenType.CLOCK)) {
        clocks.push(this.parseTestClockDecl());
      } else if (this.check(TokenType.IMPL)) {
        if (impl !== undefined) {
          throw new ParseError('Multiple impl blocks not allowed', this.peek());
        }
        impl = this.parseTestImplBlock();
      } else {
        throw new ParseError(
          `Unexpected token in testbench body: ${this.peek().type}`,
          this.peek()
        );
      }
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      name,
      circuitRef,
      inputs,
      outputs,
      clocks,
      impl,
      location: createRange(start.location.start, end.location.end),
    };
  }

  private parseCircuitRef(): CircuitRef {
    const start = this.peek();
    this.consume(TokenType.CIRCUIT, "Expected 'circuit'");
    const circuitName = this.consume(TokenType.IDENTIFIER, 'Expected circuit name').value;
    this.consume(TokenType.AS, "Expected 'as'");
    const instanceName = this.consume(TokenType.IDENTIFIER, 'Expected instance name').value;

    return {
      circuitName,
      instanceName,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseTestInputDecl(): TestInputDecl {
    const start = this.previous(); // INPUT token already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected input name').value;
    this.consume(TokenType.COLON, "Expected ':'");

    const typeToken = this.advance();
    let portType: 'Bit' | 'Bus';
    let width: number | undefined;

    if (typeToken.type === TokenType.BIT) {
      portType = 'Bit';
    } else if (typeToken.type === TokenType.BUS) {
      portType = 'Bus';
      this.consume(TokenType.LBRACKET, "Expected '['");
      const widthToken = this.consume(TokenType.NUMBER, 'Expected bus width');
      width = widthToken.numberValue!;
      this.consume(TokenType.RBRACKET, "Expected ']'");
    } else {
      throw new ParseError('Expected Bit or Bus type', typeToken);
    }

    return {
      name,
      portType,
      width,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseTestOutputDecl(): TestOutputDecl {
    const start = this.previous(); // OUTPUT token already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected output name').value;
    this.consume(TokenType.COLON, "Expected ':'");

    const typeToken = this.advance();
    let portType: 'Bit' | 'Bus';
    let width: number | undefined;

    if (typeToken.type === TokenType.BIT) {
      portType = 'Bit';
    } else if (typeToken.type === TokenType.BUS) {
      portType = 'Bus';
      this.consume(TokenType.LBRACKET, "Expected '['");
      const widthToken = this.consume(TokenType.NUMBER, 'Expected bus width');
      width = widthToken.numberValue!;
      this.consume(TokenType.RBRACKET, "Expected ']'");
    } else {
      throw new ParseError('Expected Bit or Bus type', typeToken);
    }

    return {
      name,
      portType,
      width,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseTestClockDecl(): TestClockDecl {
    const start = this.previous(); // CLOCK token already consumed
    const name = this.consume(TokenType.IDENTIFIER, 'Expected clock name').value;

    // Phase 4: Parse optional frequency
    let frequency: FrequencyExpr | undefined;
    if (this.match(TokenType.AT_SIGN)) {
      frequency = this.parseFrequencyExpr();
    }

    return {
      name,
      frequency,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseFrequencyExpr(): FrequencyExpr {
    const start = this.peek();
    const valueToken = this.consume(TokenType.NUMBER, 'Expected frequency value');
    const value = valueToken.numberValue!;

    const unitToken = this.consume(TokenType.IDENTIFIER, 'Expected frequency unit (Hz, kHz, MHz, GHz)');
    const unitStr = unitToken.value.toLowerCase();

    let unit: 'Hz' | 'kHz' | 'MHz' | 'GHz';
    if (unitStr === 'hz') {
      unit = 'Hz';
    } else if (unitStr === 'khz') {
      unit = 'kHz';
    } else if (unitStr === 'mhz') {
      unit = 'MHz';
    } else if (unitStr === 'ghz') {
      unit = 'GHz';
    } else {
      throw new ParseError(`Invalid frequency unit: ${unitStr}. Expected Hz, kHz, MHz, or GHz`, unitToken);
    }

    return {
      value,
      unit,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseTestImplBlock(): TestImplBlock {
    const start = this.peek();
    this.consume(TokenType.IMPL, "Expected 'impl'");
    this.consume(TokenType.LBRACE, "Expected '{'");

    const nodes: TestNodeDecl[] = [];
    const connections: TestConnectionStmt[] = [];
    const stimulus: StimulusBlock[] = [];
    let capture: CaptureBlock | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.NODE)) {
        nodes.push(this.parseTestNodeDecl());
      } else if (this.match(TokenType.CONNECT)) {
        connections.push(this.parseTestConnectionStmt());
      } else if (this.match(TokenType.STIMULUS)) {
        stimulus.push(this.parseStimulusBlock());
      } else if (this.match(TokenType.CAPTURE)) {
        if (capture !== undefined) {
          throw new ParseError('Multiple capture blocks not allowed', this.peek());
        }
        capture = this.parseCaptureBlock();
      } else {
        throw new ParseError(
          `Unexpected token in testbench impl: ${this.peek().type}`,
          this.peek()
        );
      }
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      nodes,
      connections,
      stimulus: stimulus.length > 0 ? stimulus : undefined,
      capture,
      location: createRange(start.location.start, end.location.end),
    };
  }

  private parseTestNodeDecl(): TestNodeDecl {
    const start = this.previous(); // NODE token already consumed
    const instanceName = this.consume(TokenType.IDENTIFIER, 'Expected node instance name').value;
    this.consume(TokenType.COLON, "Expected ':'");
    const componentType = this.consume(TokenType.IDENTIFIER, 'Expected component type').value;

    return {
      instanceName,
      componentType,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseTestConnectionStmt(): TestConnectionStmt {
    const start = this.previous(); // CONNECT token already consumed
    const source = this.parsePortRef();
    this.consume(TokenType.ARROW, "Expected '->'");
    const target = this.parsePortRef();

    return {
      source,
      target,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseStimulusBlock(): StimulusBlock {
    const start = this.previous(); // STIMULUS token already consumed
    this.consume(TokenType.ON, "Expected 'on'");
    const clockRef = this.consume(TokenType.IDENTIFIER, 'Expected clock name').value;
    this.consume(TokenType.LBRACE, "Expected '{'");

    const events: StimulusEvent[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      events.push(this.parseStimulusEvent());
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    return {
      clockRef,
      events,
      location: createRange(start.location.start, end.location.end),
    };
  }

  private parseStimulusEvent(): StimulusEvent {
    const start = this.peek();
    this.consume(TokenType.AT, "Expected 'at'");

    const timing = this.parseStimulusTiming();
    this.consume(TokenType.COLON, "Expected ':'");

    const assignments: StimulusAssignment[] = [];

    do {
      assignments.push(this.parseStimulusAssignment());
    } while (this.match(TokenType.COMMA));

    return {
      timing,
      assignments,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseStimulusTiming(): StimulusTiming {
    const start = this.peek();
    const startCycle = this.parseExpression();

    // Check for range (..)
    if (this.match(TokenType.DOTDOT)) {
      const endCycle = this.parseExpression();

      // Check for step
      if (this.match(TokenType.STEP)) {
        const stepToken = this.consume(TokenType.NUMBER, 'Expected step value');
        const step = stepToken.numberValue!;

        return {
          kind: 'stepped',
          start: startCycle,
          end: endCycle,
          step,
          location: createRange(start.location.start, this.previous().location.end),
        } as SteppedTiming;
      }

      return {
        kind: 'range',
        start: startCycle,
        end: endCycle,
        location: createRange(start.location.start, this.previous().location.end),
      } as RangeTiming;
    }

    // Single cycle
    return {
      kind: 'single',
      cycle: startCycle,
      location: createRange(start.location.start, this.previous().location.end),
    } as SingleCycleTiming;
  }

  private parseStimulusAssignment(): StimulusAssignment {
    const start = this.peek();
    const signal = this.consume(TokenType.IDENTIFIER, 'Expected signal name').value;
    this.consume(TokenType.ASSIGN, "Expected '='");
    const value = this.parseExpression();

    return {
      signal,
      value,
      location: createRange(start.location.start, this.previous().location.end),
    };
  }

  private parseCaptureBlock(): CaptureBlock {
    const start = this.previous(); // CAPTURE token already consumed
    this.consume(TokenType.LBRACE, "Expected '{'");

    let signals: string[] = [];
    let format: 'vcd' = 'vcd';
    let filename = '';

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.SIGNALS)) {
        this.consume(TokenType.COLON, "Expected ':'");
        signals = this.parseSignalList();
      } else if (this.match(TokenType.FORMAT)) {
        this.consume(TokenType.COLON, "Expected ':'");
        const formatToken = this.consume(TokenType.IDENTIFIER, 'Expected format (vcd)');
        if (formatToken.value !== 'vcd') {
          throw new ParseError(`Unsupported format: ${formatToken.value}. Only 'vcd' is supported`, formatToken);
        }
        format = 'vcd';
      } else if (this.match(TokenType.FILENAME)) {
        this.consume(TokenType.COLON, "Expected ':'");
        const filenameToken = this.consume(TokenType.STRING, 'Expected filename string');
        filename = filenameToken.stringValue!;
      } else {
        throw new ParseError(
          `Unexpected token in capture block: ${this.peek().type}`,
          this.peek()
        );
      }
    }

    const end = this.consume(TokenType.RBRACE, "Expected '}'");

    if (signals.length === 0) {
      throw new ParseError('Capture block must specify signals', start);
    }

    if (filename === '') {
      throw new ParseError('Capture block must specify filename', start);
    }

    return {
      signals,
      format,
      filename,
      location: createRange(start.location.start, end.location.end),
    };
  }

  private parseSignalList(): string[] {
    this.consume(TokenType.LBRACKET, "Expected '['");

    const signals: string[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      do {
        const signal = this.consume(TokenType.IDENTIFIER, 'Expected signal name').value;
        signals.push(signal);
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RBRACKET, "Expected ']'");
    return signals;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Consume an identifier, but allow certain keywords to be used as identifiers
   * (e.g., 'in' and 'out' as port names)
   */
  private consumeIdentifier(message: string): string {
    const token = this.peek();

    // Allow IDENTIFIER
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return token.value;
    }

    // Allow certain keywords to be used as identifiers (common port names)
    const allowedKeywords = [
      TokenType.IN,
      TokenType.ON,
      TokenType.INPUT,
      TokenType.OUTPUT,
      TokenType.CLOCK,
      TokenType.STATE,
      TokenType.NODE,
    ];

    if (allowedKeywords.includes(token.type)) {
      this.advance();
      return token.value;
    }

    throw new ParseError(message, token);
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParseError(message, this.peek());
  }

  private createProgramRange() {
    const start = this.tokens[0]?.location.start ?? { line: 1, column: 1, offset: 0 };
    const end = this.tokens[this.tokens.length - 1]?.location.end ?? start;
    return createRange(start, end);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse DSL tokens into an AST
 */
export function parse(tokens: Token[]): Program {
  const parser = new Parser(tokens);
  return parser.parse();
}
