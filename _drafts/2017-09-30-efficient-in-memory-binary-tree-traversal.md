---
author: Jean André Gauthier
date: 2017-09-30 15:03:06
featured_image: ./post_header.jpg
summary: "Inorder, postorder and preorder binary tree traversals are  intiutively recursive operations. Provided the tree may be modified during the traversal, it is feasible though to use a more efficient iterative and in-place approach, also called Morris Tree Traversal."
tags:
  - algorithms
  - trees
  - prog-contests
  - java
title: Efficient in-memory binary tree traversal
---
Inorder, postorder and preorder binary tree traversals are  intiutively recursive operations. Provided the tree may be modified during the traversal, it is feasible though to use a more efficient iterative and in-place approach, also called Morris Tree Traversal.

We are going to use the following internal structure for our nodes. Do note the explicit sentinel node, which is going to simplify the algorithms:

{% raw %}
<pre><code class="java">class Node {
  static Node nil = new Node();

  Node[] children;
  int value;

  Node() {
    children = new Node[] {this, this};
    value = 0;
  }

  Node(Node left, Node right) {
    children = new Node[] {left, right};
    value = 0;
  }
}
</code></pre>
{% endraw %}

We assumed an integer value, although any `Comparable` would do. The node's children are stored in the `children` array, and contains 0, 1 or 2 nodes in our case. The left child and the right child are stored in `children[0]` and `children[1]` respectively.

# Recursive tree traversals

# Stack-based tree traversals

# Morris tree traversals

However, there is way that makes helper stacks unnecessary, thus reducing the space complexity from `O(log(n))` to `O(1)`. Morris traversals [1] take a radically different approach, by using the right child pointer of nodes without a right child, to point at the next node that should be visited during the iteration.

## Pre-order Morris tree traversal

{% raw %}
<pre><code class="java">List<Integer> preorder(Node t) {
  List<Integer> preorder = new ArrayList<>();
  while (t != Node.nil) {
    Node previous = t.children[0];
    if (previous != Node.nil) {
      // The node has a left child => determine its inorder predecessor
      while (previous.children[1] != Node.nil && previous.children[1] != t) {
        previous = previous.children[1];
      }
      if (previous.children[1] == t) {
        // The inorder predecessor is the node itself => remove the cycle and move to the right child
        previous.children[1] = Node.nil;
        t = t.children[1];
      } else {
        // Set the inorder predecessor's right child to the node itself, add the node's value to the result list and move to the left child
        previous.children[1] = t;
        preorder.add(t.value);
        t = t.children[0];
      }
    } else {
      // The node has no left child => add its value to the result list and move to the right child
      preorder.add(t.value);
      t = t.children[1];
    }
  }
  return preorder;
}
</code></pre>
{% endraw %}

## In-order Morris tree traversal

{% raw %}
<pre><code class="java">List<Integer> inorder(Node t) {
  List<Integer> inorder = new ArrayList<>();
  while (t != Node.nil) {
    Node previous = t.children[0];
    if (previous != Node.nil) {
      // The node has a left child => determine its inorder predecessor
      while (previous.children[1] != Node.nil && previous.children[1] != t) {
        previous = previous.children[1];
      }
      if (previous.children[1] == t) {
        // The inorder predecessor is the node itself => remove the cycle, add the node's value to the result list and move to the right child
        inorder.add(t.value);
        previous.children[1] = Node.nil;
        t = t.children[1];
      } else {
        // Set the inorder predecessor's right child to the node itself and move to the left child
        previous.children[1] = t;
        t = t.children[0];
      }
    } else {
      // The node has no left child => add its value to the result and move to the right child
      inorder.add(t.value);
      t = t.children[1];
    }
  }
  return inorder;
}
</code></pre>
{% endraw %}

## Post-order Morris tree traversal

While the pre-order and in-order Morris traversals are relatively well-known, the post-order Morris traversal surprisingly seems to be less widespread. The reason might be that it is definitely less straightforward to implement, as a not-so-obvious trick is required to achive in-place post-order traversal.[4]

{% raw %}
<pre><code class="java">Node[] postorder(Node t) {
  List<Integer> postorder = new ArrayList<>();
  // Create a dummy node that has the root as a left child
  Node tTemp = new Node(t, Node.nil);
  while (tTemp != Node.nil) {
    Node previous = tTemp.children[0];
    if (previous != Node.nil) {
      // The node has a left child => determine its inorder predecessor
      while (previous.children[1] != Node.nil && previous.children[1] != tTemp) {
        previous = previous.children[1];
      }
      if (previous.children[1] == tTemp) {
        // The inorder predecessor is the node itself => invert the links in the cycle
        previous = tTemp;
        Node current = tTemp.children[0];
        while (current != tTemp) {
          Node next = current.children[1];
          current.children[1] = previous;
          previous = current;
          current = next;
        }
        // Loop through the inverted cycle, add the nodes' values to the result list, and reset the links to their original direction
        current = previous;
        previous = tTemp;
        while (current != tTemp) {
          postorder.add(current.value);
          Node next = current.children[1];
          current.children[1] = previous == tTemp ? Node.nil : previous;
          previous = current;
          current = next;
        }
        tTemp = tTemp.children[1];
      } else {
        // Set the inorder predecessor's right child to the node itself and move to the left child
        previous.children[1] = tTemp;
        tTemp = tTemp.children[0];
      }
    } else {
      // The node has no left child => move to the right child
      tTemp = tTemp.children[1];
    }
  }
  return postorder;
}
</code></pre>
{% endraw %}

# Example

[2]

# Conclusion

In this article we developed several algorithms to traverse a binary tree. We went from a recursive algorithm that requires logarithmic stack space to a more sophisticated algorithm that requires logarithmic heap space. Lastly, we looked at an iterative in-place approach, the Morris tree traversal, that modifies the tree while iteratating over its nodes, in order not to have to store additional information on an auxiliary stack. Bear in mind that this makes it impossible to have concurrent iteratations in the tree though [3]. Full sources can be found at [5].

Happy hacking!

[1] Link to Morris' original article about tree traversals
[2] Codeforces problem with tree traversal
[3] Link to article about concurrent Morris traversals
[4] Link to SO post for Morris post-order traversals
[5] Link to swissknife