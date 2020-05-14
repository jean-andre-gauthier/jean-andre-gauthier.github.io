---
layout: post
title:  "Java Generics Pitfalls: Covariance, Contravariance and Invariance"
date:   2018-02-28 00:00:00 +0200
categories: java
---

Java's generics seem trivial at a first glance, but as usual, the devil is in the details. In this article, we'll explore wildcards and bounded wildcards by example, in order to get a better intuition for generics.

Back in 2004, a handy new feature was added to Java: generics. Martin Odersky, my former type systems professor at EPFL was heavily involved in Generic Java, the extension that added generic types and methods to the language, and that was ultimately incorporated as the generics we know today into the core language. [^1] Although generics have become ubiquitous in the meanwhile, people still tend to get confused when dealing with generic wildcards, the topic of this article.

Before delving into the details of variance, we'll briefly recap the basics:
1. A generic type is declared with a type parameter in angle brackets. The declaration may be added at the class level, e.g. in `class Foo<T> { ... use T ... }`, at the constructor level, or at the method level `<T> void foo() { ... use T here ... }`
2. Generics are erased at runtime in most cases [^2], which means that one can't create instances of type parameters, can't use casts or instanceof with parameterised types, can't create arrays of parameterised types, and can't catch or throw objects of paramterised types.

After this short summary, we may now define the type hierarchy for our experiments:

```
class Vehicle {}

class Car extends Vehicle {}

class Cabriolet extends Car {}

class Sedan extends Car {}
```
{: .language-java}

Our first experiment simply consists of creating an array of `Car` and an array of `Cabriolet`. Things quickly become confusing though, because Java allows assigning the `Cabriolet` array to the `Car` array. At a first glance, this just looks like regular polymorphism extended to arrays; it simply allows passing a `Cabriolet` array to a method that operates on a `Car` array. However, one may reassign a value to a cell in the array, and cause a runtime exception as shown below:

```
// Nothing fancy here
Car[] cars = { new Car() };
Cabriolet[] cabriolets = { new Cabriolet() };

// Legal, since arrays are covariant. cabriolets = cars would not be allowed though, since arrays are not contravariant
cars = cabriolets;
// Obviously legal, a is an array of Car[]
cars[0] = new Car();
// ArrayStoreException, since cabriolets now contains a Car, not a Cabriolet
// This is why you should avoid relying on array covariance whenever possible
Cabriolet cabriolet = cabriolets[0];
```
{: .language-java}

Java's type system would have been able to catch the error had arrays been made invariant; the assignment `cars = cabriolets` would have caused a compilation error. However, this would have been seriously limiting, as one couldn't have written a general-purpose method that sorts a `Vehicle` array by calling a `getNumberOfSeats()` method on `Vehicle` for example. Also, the error was not really caused by the assignment `cars = cabriolets`. Retrieving a `Car` from the `cars` array would not cause any runtime exception, only storing a new `Car` would. Had we been allowed to write `cabriolets = cars` instead, we would have ended up in the opposite situation: storing a new `Cabriolet` in `cabriolets` would not cause a runtime exception, but trying to retrieve a `Cabriolet` from `cabriolets` would. In any case, the type system is not sound since it can't prevent such runtime exceptions.

Generic types sidestep the issue because they are invariant by design:

```
List<Vehicle> vehicles = new ArrayList<>();
vehicles.set(0, new Vehicle());
List<Car> cars = new ArrayList<>();
cars.set(0, new Car());
List<Cabriolet> cabriolets = new ArrayList<>();
cabriolets.set(0, new Cabriolet());
List<Sedan> sedans = new ArrayList<>();
sedans.set(0, new Sedan());

// Illegal, since Lists are invariant
cars = cabriolets;
// Illegal too
cabriolets = cars;
```
{: .language-java}

If variance is needed, one has to specify whether the variable should provide a read-only (covariance) or a write-only access (contravariance) by using bounded wildcards.

In general, wildcards do not need to be bounded though. In that case, they are called unbounded wildcards, and are defined as follows:

```
List<?> unboundedList = ...;
```
{: .language-java}

Unbounded wildcards may e.g. be useful for methods that do not require any type information from the parameterised type they operate on:

```
void printCollection(List<?> l) {
  for (Object o : l){
    System.out.println(o);
  }
}
```
{: .language-java}

On the other hand, bounded wildcards may either be bounded with a `? extends T` or with a `? super T`.

*Covariance* is achieved by the former expression. The wildcard specifies that the list may contain any subtype of the type bound:

```
List<? extends Car> covariantCars = new ArrayList<>();
```
{: .language-java}

`covariantCars` may therefore contain `Car`s, `cabriolet`s or any descendants from those classes. When assigning a reference to a covariant type `R<? extends T>`, one can use a variable with type `S<U>` where `S <: R` and `U <: T` (`<:` standing for the subtype relation), or a variable with a bounded type. In the latter case, any `S<? extends U>` would be allowed:

```
// Legal, since covariantCars is a covariant list
covariantCars = cars;
// Also legal, for the same reason. You'll still be able to retrieve a Car with a get operation later on.
covariantCars = cabriolets;
// Illegal, since covariantCars is not contravariant. You wouldn't be able to retrieve a Car with a get operation later on
covariantCars = vehicles;
// This is illegal too, since cars is invariant
cars = covariantCars;
// Legal, since unboundedList is unbounded
List<?> unboundedList = covariantCars;
// Not legal, generic lists are invariant
List<Object> objectList1 = covariantCars;
// Not legal either
List<Object> objectList2 = unboundedList;
```
{: .language-java}

`covariantCars` may safely be accessed in a read-only manner, as all items in the `List` are guaranteed to be a `Car`. However, storing an item in the `List` won't be possible. The reason for this restriction is that `covariantCars` might actually be a `List<Cabriolet>` under the hood, and inserting a `Car` therefore wouldn't make sense:

```
// Contrarily to what you could expect, you can neither insert a supertype nor a subtype in a covariant list. The reason is that covariantCars may actually contain subtypes, e.g due to covariantCars = cabriolets. This would cause a crash if you tried to access a Cabriolet through cabriolets.
covariantCars.set(0, new Car());
covariantCars.set(0, new Vehicle());
// But covariantCars may actually be a List<Sedan>, that's why the next statement is not legal either
covariantCars.set(0, new Cabriolet());
// Obviously doesn't work either
covariantCars.set(0, new Object());
// Although you can't insert anything in covariantCars, you can retrieve a Car out of it, and call its methods as expected
Car car = covariantCars.get(0);
System.out.println(car.getNumberOfTyres());
```
{: .language-java}

*Contravariance* is expressed with a wildcard bounded by `super T`. The wildcard specifies that the list may contain any supertype of the type bound:

```
List<? super Car> contravariantCars = new ArrayList<>();
```
{: .language-java}

`contravariantCars` may safely be accessed in a write-only manner, as all items in the `List` are guaranteed not to be lower in the type hierarchy than a `Car`. However, retrieving an item from the `List` won't be possible. The reason for this restriction is that `contravariantCars` might actually be a `List<Car>`, `List<Vehicle>` or `List<Object>` under the hood, and one therefore wouldn't know what to retrieve:

```
// This works as expected, as Object is a super type of Car, and l is contravariant
contravariantCars = new ArrayList<Object>();
// Same remark applies
contravariantCars = vehicles;
// Same remark applies
contravariantCars = cars;
// This is not legal however, since Cabriolet is not a super type of Car. Otherwise, you would be able to insert a Car in a cabriolets, and cause an Exception when trying to retrieve a Cabriolet from that list later on.
contravariantCars = cabriolets;
// This works as expected
contravariantCars.set(0, new Car());
// Beware, the bounds seemingly behave in the opposite way when using set(). You can't insert a Vehicle, because you might be dealing with an aliased list of Car, and could cause an exception when trying to retrieve a Car later on
contravariantCars.set(0, new Vehicle());
// Inserting a Cabriolet is fine though:
contravariantCars.set(0, new Cabriolet());
// You can't retrieve anything useful from contravariantCars though, because you won't know whether you're dealing with an aliased list of Vehicle. The following line is going to cause a compilation error:
Car car = contravariantCars.get(0);
```
{: .language-java}

In summary, one should use a covariant type bound when read-only access is required, a contravariant type bound for a write-only accesses, and an invariant type when both read and write access is necessary. Further details about generics can be found on Angelika Langer's blog. [^3]

Happy hacking :)

[^1]: [Bracha, Gilad, et al. "Making the future safe for the past: Adding genericity to the Java programming language." Acm sigplan notices 33.10 (1998): 183-200.](http://homepages.inf.ed.ac.uk/wadler/papers/gj-oopsla/gj-oopsla-letter.pdf)
[^2]: [Gomes, R. (2013). Using TypeTokens to retrieve generic parameters. \[Blog\] Notes, Experiences and Opinions by Richard Gomes. Available at: http://rgomes-info.blogspot.com/2013/12/using-typetokens-to-retrieve-generic.html \[Accessed 28 Feb. 2018\].](http://rgomes-info.blogspot.com/2013/12/using-typetokens-to-retrieve-generic.html)
[^3]: [Langer, A. (n.d.). Java Generics FAQs - Frequently Asked Questions. \[Blog\] Angelika Langer's Home Page. Available at: http://www.angelikalanger.com/GenericsFAQ/JavaGenericsFAQ.html \[Accessed 28 Feb. 2018\].](http://www.angelikalanger.com/GenericsFAQ/JavaGenericsFAQ.html)