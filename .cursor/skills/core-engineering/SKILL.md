---
name: core-engineering
description: Object-oriented design and Core Engineering principles for AI agents and developers. Use when the user asks about OOP (four pillars), SOLID, encapsulation, abstraction, inheritance, polymorphism, Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion, composition over inheritance, DRY, KISS, YAGNI, Law of Demeter, or association vs aggregation vs composition. Includes how each principle looks and example code.
license: See repository LICENSE
---

# Object-Oriented Design Skill

This skill defines Core Engineering: Object-Oriented Programming (OOP), SOLID, clean-code principles, and relationship types with concrete examples so an AI agent or developer can apply them consistently.

---

## 1. Four Pillars of OOP

### 1.1 Abstraction

**What it is:** Focus on what an object does, not how. Hide complex details and expose only essential behavior.

**How it looks:** Public methods define the contract; internals are private or hidden.

```typescript
// Abstraction: caller uses start() and stop() without knowing engine details
class Car {
  private engine: Engine;

  start(): void {
    this.engine.ignite();
  }
  stop(): void {
    this.engine.shutOff();
  }
}
```

**Types of abstraction:**
- **Data abstraction:** Hide how data is stored (e.g. use getters instead of raw fields).
- **Control abstraction:** Hide how a process is implemented (e.g. `save()` instead of open/write/close).

```typescript
// Data abstraction: storage details hidden
class UserRepo {
  private store: Map<string, User>;
  getById(id: string): User | undefined {
    return this.store.get(id);
  }
}
```

---

### 1.2 Encapsulation

**What it is:** Bundle data and methods that act on that data in one unit (class). Restrict direct access to internal state to avoid accidental misuse.

**How it looks:** Private fields, public accessors or methods; no direct property access from outside.

```typescript
// Encapsulation: balance is protected; changes only through deposit/withdraw
class BankAccount {
  private balance: number = 0;

  deposit(amount: number): void {
    if (amount > 0) this.balance += amount;
  }
  withdraw(amount: number): boolean {
    if (amount > 0 && amount <= this.balance) {
      this.balance -= amount;
      return true;
    }
    return false;
  }
  getBalance(): number {
    return this.balance;
  }
}
```

---

### 1.3 Inheritance

**What it is:** A child class gets properties and behavior from a parent class to reuse code and model "is-a" relationships.

**How it looks:** Child extends parent and can override methods or add new ones.

```typescript
// Inheritance: SportsCar is-a Vehicle with extra behavior
class Vehicle {
  move(): void {
    console.log("Moving");
  }
}
class SportsCar extends Vehicle {
  turboBoost(): void {
    console.log("Turbo engaged");
  }
}
```

---

### 1.4 Polymorphism

**What it is:** Different classes can be used through the same interface; the same method name can behave differently per type.

**How it looks:** Parent reference, child instances; overridden methods or shared interface.

```typescript
// Polymorphism: same call, different behavior per type
abstract class Shape {
  abstract draw(): void;
}
class Circle extends Shape {
  draw(): void {
    console.log("Drawing circle");
  }
}
class Square extends Shape {
  draw(): void {
    console.log("Drawing square");
  }
}
function render(s: Shape): void {
  s.draw();
}
render(new Circle());
render(new Square());
```

---

## 2. SOLID Principles

### 2.1 Single Responsibility Principle (SRP)

**What it is:** A class should have only one reason to change (one responsibility).

**How it looks:** One class does one job; split reporting, persistence, and validation into separate types.

```typescript
// SRP: each class has one job
class Order {
  constructor(
    public id: string,
    public total: number
  ) {}
}
class OrderRepository {
  save(order: Order): void {
    // persist only
  }
}
class OrderReport {
  format(order: Order): string {
    return `Order ${order.id}: ${order.total}`;
  }
}
```

---

### 2.2 Open/Closed Principle (OCP)

**What it is:** Open for extension, closed for modification. Add behavior via new code (e.g. new classes), not by changing existing code.

**How it looks:** Use abstractions and new implementations instead of editing existing classes.

```typescript
// OCP: extend via new class, not by changing Discount
interface Discount {
  apply(amount: number): number;
}
class PercentDiscount implements Discount {
  constructor(private percent: number) {}
  apply(amount: number): number {
    return amount * (1 - this.percent / 100);
  }
}
class FixedDiscount implements Discount {
  constructor(private fixed: number) {}
  apply(amount: number): number {
    return Math.max(0, amount - this.fixed);
  }
}
```

---

### 2.3 Liskov Substitution Principle (LSP)

**What it is:** Subclasses must be substitutable for their base class without breaking callers.

**How it looks:** Overrides preserve contracts (same preconditions/postconditions); no throwing new errors or weakening guarantees.

```typescript
// LSP: Rectangle subclass can replace Shape without breaking callers
class Shape {
  area(): number {
    return 0;
  }
}
class Rectangle extends Shape {
  constructor(private w: number, private h: number) {
    super();
  }
  area(): number {
    return this.w * this.h;
  }
}
function printArea(s: Shape): void {
  console.log(s.area());
}
printArea(new Rectangle(3, 4));
```

---

### 2.4 Interface Segregation Principle (ISP)

**What it is:** Clients should not depend on methods they do not use. Prefer small, focused interfaces.

**How it looks:** Many small interfaces instead of one large one; classes implement only what they need.

```typescript
// ISP: split fat interface into small ones
interface Readable {
  read(): string;
}
interface Writable {
  write(data: string): void;
}
class FileReader implements Readable {
  read(): string {
    return "data";
  }
}
class FileWriter implements Writable {
  write(data: string): void {}
}
// Client that only reads depends only on Readable
function consume(r: Readable): void {
  r.read();
}
```

---

### 2.5 Dependency Inversion Principle (DIP)

**What it is:** Depend on abstractions (interfaces), not concrete classes. High-level logic should not import low-level details.

**How it looks:** Inject interfaces; concrete implementations passed in or provided by composition root.

```typescript
// DIP: OrderService depends on abstraction, not concrete Logger
interface Logger {
  log(msg: string): void;
}
class OrderService {
  constructor(private logger: Logger) {}
  placeOrder(): void {
    this.logger.log("Order placed");
  }
}
class ConsoleLogger implements Logger {
  log(msg: string): void {
    console.log(msg);
  }
}
const service = new OrderService(new ConsoleLogger());
```

---

## 3. Composition Over Inheritance

**What it is:** Favor composing objects (has-a) over deep inheritance (is-a) to reduce coupling and increase flexibility.

**How it looks:** Classes hold references to other types instead of extending them; behavior is delegated.

```typescript
// Composition: Engine is a component, not a parent
class Engine {
  start(): void {
    console.log("Engine started");
  }
}
class Car {
  private engine: Engine;
  constructor() {
    this.engine = new Engine();
  }
  start(): void {
    this.engine.start();
  }
}
```

---

## 4. Clean Code Principles

### 4.1 DRY (Don't Repeat Yourself)

**What it is:** Avoid duplicating logic; centralize in one place.

```typescript
// DRY: single function for validation
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
// Reuse everywhere instead of copying the regex
```

---

### 4.2 KISS (Keep It Simple, Stupid)

**What it is:** Avoid unnecessary complexity; prefer straightforward solutions.

```typescript
// KISS: simple condition instead of over-engineered pattern
function isEligible(age: number): boolean {
  return age >= 18;
}
```

---

### 4.3 YAGNI (You Aren't Gonna Need It)

**What it is:** Do not add functionality until it is required.

**How it looks:** No speculative features or "might need later" code; implement when the need exists.

---

### 4.4 Law of Demeter (LoD)

**What it is:** An object should only talk to its immediate neighbors (its own attributes, method arguments, or objects it creates). Avoid long chains like `a.getB().getC().doSomething()`.

**How it looks:** Delegate to a neighbor so the caller uses one dot.

```typescript
// LoD violation: client knows internal structure
// client.getAddress().getStreet().toUpperCase()

// Better: one level of indirection
class Client {
  getStreetUpperCase(): string {
    return this.address.getStreet().toUpperCase();
  }
}
```

---

## 5. Advanced Relationship Types

### 5.1 Association

**What it is:** General link between two objects; they can interact but are not necessarily owned.

```typescript
// Association: Teacher and Student know each other
class Teacher {
  constructor(public students: Student[]) {}
}
class Student {
  constructor(public teacher: Teacher) {}
}
```

---

### 5.2 Aggregation (has-a; child can outlive parent)

**What it is:** Whole has parts; parts can exist without the whole (e.g. department has employees; employees can exist without the department).

```typescript
// Aggregation: Department has Employees; employees can exist independently
class Department {
  constructor(public employees: Employee[] = []) {}
  add(e: Employee): void {
    this.employees.push(e);
  }
}
class Employee {
  constructor(public name: string) {}
}
```

---

### 5.3 Composition (part-of; child cannot outlive parent)

**What it is:** Strong ownership; the part does not exist without the whole (e.g. Engine cannot exist without the Car in the same lifecycle).

```typescript
// Composition: Engine is created and owned by Car; lifecycle bound
class Car {
  private engine: Engine;
  constructor() {
    this.engine = new Engine();
  }
}
class Engine {}
```

---

## Quick Reference

| Concept | One-line |
|--------|----------|
| Abstraction | Expose what, hide how |
| Encapsulation | Bundle data + methods; restrict direct access |
| Inheritance | Child reuses parent behavior (is-a) |
| Polymorphism | Same interface, different behavior per type |
| SRP | One reason to change per class |
| OCP | Extend via new code, don't modify existing |
| LSP | Subtypes substitutable for base type |
| ISP | Small interfaces; no unused methods |
| DIP | Depend on abstractions, not concretions |
| Composition | Prefer has-a over deep inheritance |
| DRY | One place for each piece of logic |
| KISS | Prefer simple design |
| YAGNI | Build only what is needed now |
| LoD | Talk only to immediate neighbors |
| Association | General link between objects |
| Aggregation | Has-a; part can outlive whole |
| Composition | Part-of; part bound to whole lifecycle |
