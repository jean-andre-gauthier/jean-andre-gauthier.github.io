---
layout: post
title:  "Find a queue's minimum element in O(1)"
date:   2017-07-30 00:00:00 +0200
categories: data-structures java swissknife
---

In this post, I intend to show you a neat little trick to find a queue's minimum element in constant-time.

Every now and then you stumble upon [a problem](https://leetcode.com/problems/sliding-window-maximum/description/) that asks you to find the minimal/maximal element in a queue. That is, the three required operations are `dequeue(q)`, `enqueue(q, e)` and `find-min(q)`. An obvious solution is to iterate in `O(n)` through the queue's underlying data structure, e.g. a doubly linked list or a dynamic array. Unfortunately, that won't be enough for an AC submission in most cases. However, provided we are willing to trade a bit of space for the sake of running time, we can lower the complexity of `find-min` to `0(1)`.

## Monotonic stacks

Let's start with a simpler problem, i.e. finding the minimal/maximal element in a stack. We'll work with a dynamic array as an underlying data structure, but the approach would have been the same with a doubly-linked list.

Beside the obvious approach of iterating through the array, we could also store an additional helper value when pushing an item on the stack. Which value would help us find the min of the stack? Obviously the minimum between the item being pushed on the stack and the stack's current minimum:

```
class MonotonicStackInt {
  int[][] stack;
  int top;
  MonotonicStackInt(int capacity) {
    stack = new int[capacity][2];
    top = -1;
  }
  int getMin() {
    return stack[top][1];
  }
  int pop() {
    return stack[top--][0];
  }
  void push(int i) {
    // Additional logic to resize stack has been left out
    top++;
    stack[top][0] = i;
    stack[top][1] = top == 0 ? i : Math.min(i, stack[top - 1][1]);
  }
}
```
{: .language-java}

Implementing `find-min` is now just a matter of returning the helper value on the top of the stack.

## Monotonic queues

Now that we have found an efficient way to implement the `find-min` operation for stacks, we will be able generalise the solution to FIFO queues. A queue can easily be constructed with two stacks that we'll call `stackIn` and `stackOut` respectively.

The `enqueue` operation simply consists in pushing the item on `stackIn`, with a running time amortised in `O(1)`:

```
void enqueue(int i) {
  stackIn.push(i);
}
```
{: .language-java}

The `dequeue` operation is only slightly more complicated, as we have to pop items from `stackIn` to push them on `stackOut`, in case `stackOut` is empty:

```
int dequeue() {
  if (!stackOut.isEmpty()) {
    return stackOut.pop();
  } else {
    while (!stackIn.isEmpty()) {
      stackOut.push(stackIn.pop());
    }
    return stackOut.pop();
  }
}
```
{: .language-java}

This operation also has a running time amortised in `O(1)`, as each item will be moved from the input to the output stack exactly once.

`find-min` can then be implemented in constant time by taking the min of `stackIn` and `stackOut`:

```
int getMin() {
  return stackIn.isEmpty()
    ? stackOut.getMin()
    : stackOut.isEmpty()
      ? stackIn.getMin()
      : Math.min(stackIn.getMin(), stackOut.getMin());
}
```
{: .language-java}

The key to understanding this approach is to notice that the `dequeue` operation is going to recalculate the minimum / maximum of `stackOut`, when it moves items from `stackIn` to `stackOut`. This allows the `find-min` operation to return the correct min/max value.

## Example
This example is taken from LeetCode Problem 239: [^1]

*Given an array nums, there is a sliding window of size k which is moving from the very left of the array to the very right. You can only see the k numbers in the window. Each time the sliding window moves right by one position.*

*For example, given nums = [1,3,-1,-3,5,3,6,7], and k = 3, [...] return the max sliding window as [3,3,5,5,6,7].*

As we can see, this problem is a straightforward application of monotonic queues. We just have to make sure not forget the corner case where `nums` is an empty array:

```
public int[] maxSlidingWindow(int[] nums, int k) {
  int n = nums.length;
  if (n == 0) {
    return new int[0];
  }
  int[] solution = new int[n - k + 1];
  MonotonicQueueInt q = new MonotonicQueueInt(k);
  for (int i = 0; i < n; ++i) {
    q.enqueue(nums[i]);
    if (i >= k - 1) {
      solution[i - k + 1] = q.getMax();
      q.dequeue();
    }
  }
  return solution;
}
```
{: .language-java}

## Conclusion
In this post, we saw how to implement a `find-min` operation on queue in `O(1)` by using two array-backed stacks. It should be noted that this approach only makes sense in a setting where we need `dequeue` to return the dequeued value. Otherwise, we might as well use a plain old `Deque<>`, and remove the items with a larger/smaller value than the enqueued item at the back, as they won't affect the minimum/maximum in any case. [1] This technique can also be adapted to store `long`s and `double`s, but make sure to use safe comparators in the latter case. The full source code can be found [on GitHub](https://github.com/jean-andre-gauthier/swissknife), and further discussions on [this](https://stackoverflow.com/questions/12054415/get-min-max-in-o1-time-from-a-queue) StackOverflow post.

Happy hacking :)

[^1]: [Sliding window maximum - LeetCode](https://leetcode.com/problems/sliding-window-maximum/discuss/65885)