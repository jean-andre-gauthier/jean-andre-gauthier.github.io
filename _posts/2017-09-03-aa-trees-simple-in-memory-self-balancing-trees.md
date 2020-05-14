---
layout: post
title:  "AA trees: simple in-memory self-balancing trees"
date:   2017-09-03 00:00:00 +0200
categories: data-structures java swissknife
---

Red and black trees are a popular albeit complicated implementation of balanced binary trees. In this article I'll present my implementation of AA trees, a simpler yet reasonably performant alternative to RB trees.

In a nutshell, a self-balancing tree is a binary search tree that maintains a height invariant during insertions and deletions, in order to speed up subsequent lookups. Such trees have been extensively studied in the last decades, resulting in several implementations with different advantages and drawbacks:

* *Red-Black trees* are an excellent multi-purpose self-balancing tree. They are used for ordered associative arrays (e.g. Java's `TreeMap`), in hash table buckets (e.g. in Java's `HashMap`), or for process scheduling (e.g. in Linux's completely fair scheduler [1]). The height invariant is maintained by storing a color bit, that is used for rebalancing a tree after an insertion or deletion. The space overhead is minimal, since the color bit can be stored in the least significant bit of the reference to the tree nodes.
* *AVL trees* allow the balance factor of any node, i.e. the difference between the height of the right and left child, to be at most 1. They are therefore more strictly balanced than RB trees, and perform better in lookup-intensive settings, at the expense of slower insertions and deletions.
* *Splay trees* are based on a splay operation, that moves a node to the root and rebalances the tree in the process. Splaying is done during insertions and lookups, and has the effect of moving recently acceessed nodes closer to the root. This is beneficial in settings where the query distribution is not uniform. [3]
* *AA trees* present characteristics similar to AVL trees, when being compared to RB trees. They have been designed for simplicity rather than performance, but seem to perform reasonably well in practice. [4]

# 2-3 Trees

As AA trees simulate 2-3 trees, we'll briefly recap how the latter work. By definition, there are two kinds of nodes in a 2-3 tree: 2-nodes or 3-nodes. *2-nodes* contain one value, and may have a left and a right child that contain values respectively smaller or larger than their parent's value. *3-nodes* contain two values and three children; the left child's values are smaller than the left value, the middle child's values between the left and right values, and the right child's values larger than the right value. 2-3 trees additionally maintain the invariant that all children of a node must have the same height.

![2-3 tree node types]({{ site.url }}/_downloads/2017/09/03/2_3_nodes.png "2-3 tree node types")

The invariants of a 2-3 tree therefore can be summarised as follows:
1. Every node is a 2-node or a 3-node
2. The left child and the right child of a node both have the same height

![Valid and invalid 2-3 trees]({{ site.url }}/_downloads/2017/09/03/2_3_valid_invalid.png "Valid and invalid 2-3 trees")

* Search:

Looking for an element in the tree works essentially the same way as for regular binary search trees:

```
search(T, n):
  v <- T.root
  while true:
    if v has no children:
      return v
    if n < v.firstValue
      v <- v.firstChild
    else if (v is a 2-node and v.firstValue < n) or (v is a 3-node and v.firstValue < n < v.secondValue):
      v <- v.secondChild
    else if v.secondValue < n:
      v <- v.thirdChild
    else:
      return v;
```

![Search]({{ site.url }}/_downloads/2017/09/03/2_3_search.png "Search")

After that, one just needs to check whether the returned node effectively contains the value. The operation therefore runs in logarithmic time.

* Insertion:

Insertion essentially inserts a new 2-node, and combines and splits the nodes on the path towards the root whenever one of the  invariants is broken. We're ignoring duplicates for simplicity:

```
insert(T, n):
  w <- new 2-node(n)
  if T is nil:
    return w

  v <- search(n)
  if n < v.firstValue
    v.firstChild <- w
  else if (v is a 2-node and v.firstValue < n) or (v is a 3-node and v.firstValue < n < v.secondValue):
    v.secondChild <- w
  else if v.secondValue < n:
    v.thirdChild <- w

  v <- w
  while v is not T.root:
    combine(v)
    split(v)
    v <- v.parent
  return v
```

![Insert (2-node)]({{ site.url }}/_downloads/2017/09/03/2_3_insert_2.png "Insert (2-node)")

![Insert (3-node)]({{ site.url }}/_downloads/2017/09/03/2_3_insert_3.png "Insert (3-node)")

An insertion is therefore guaranteed to have a logarithmic worst-case running time.

* Deletion:

Deletion proceeds by looking up the value in the tree, replacing it with its inorder predecessor, and redistributing / merging nodes on the path to the root, whenever an invariant gets broken:

```
delete(T, n):
  v <- search(n)

  if v has children:
    swap v the value equal to n with the value from its inorder predecessor
    v <- inorderPredecessor(T, v)

  if v is a 3-node:
    replace v by a 2-node that contains the remaining value
  else if v is a 2-node:
    while v is not nil:
      if v can be redistributed:
        redistribute(v)
      else:
        merge(v)
      v <- v.parent
```

![Delete (3-node leaf)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_3.png "Delete (3-node leaf)")

![Delete (redistribute, 2-node leaf, 2-node parent)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_redistribute_2_2.png "Delete (redistribute, 2-node leaf, 2-node parent)")

![Deleting in a 2-3 tree (redistribute, 2-node leaf, 3-node parent)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_redistribute_2_3.png "Delete (redistribute, 2-node leaf, 3-node parent)")

![Delete (merge, 2-node leaf, 2-node parent)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_merge_2_2.png "Delete (merge, 2-node leaf, 2-node parent)")

![Delete (merge, 2-node leaf, 3-node parent)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_merge_2_3.png "Delete (merge, 2-node leaf, 3-node parent)")

![Delete (internal 2-node)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_internal_2.png "Delete (internal 2-node)")

![Delete (internal 3-node)]({{ site.url }}/_downloads/2017/09/03/2_3_delete_internal_3.png "Delete (internal 3-node)")

Proving that the tree remains balanced after insertions / deletions is beyond the scope of this post. It can be proved relatively straightforwardly that insertion maintains the tree's invariants, by using total induction on the number of nodes in the tree. The deletion case can likely be proved similarly.

# AA Trees

AA trees simulate 2-3 trees by storing the level for each node of the tree. The space overhead for a tree of `n` nodes is therefore `o(n log log n)`, but has the advantage of simplifying the rebalancing operations. AA trees maintain the following invariants when modified by an insertion or a deletion:

1. Each leaf has a level of one.
2. Each left child has a level that is exactly one less than the one of its parent. This implies that horizontal left links are prohibited.
3. Each right child has a level that is equal to or one less than the one of its parent. This implies that horizontal right links are allowed.
4. Each right grandchild has a level that is one less than the one of its grand-parent. This implies that two consecutive horizontal right links are prohibited.
5. Each node that has a level greater than one has two children.

![Valid and invalid AA trees]({{ site.url }}/_downloads/2017/09/03/aa_valid_invalid.png "Valid and invalid AA trees")

These invariants make sure that the tree's maximal height remains logarithmic in the number of nodes. We make the assumption that there are no duplicates in the tree, as they can easily be dealt with by adding a counter to each node.

## Node representation

A node consists of three fields: an array of children, which helps writing terser code than if using a left and right child pointer, an integer storing the node's level and a value either of a primitive type or any type that defines a comparison operation.

```
class Node {
    static Node nil = new Node();

    Node[] children;
    int level;
    int value;

    Node() {
      children = new Node[] {this, this};
      level = 0;
      value = 0;
    }

    Node(int value) {
      children = new Node[] {nil, nil};
      level = 1;
      this.value = value;
    }
}
```
{: .language-java}

Additionnally, a sentinel node with level 0 is defined, in order to simplify the operations on the tree.

## Skew and split

Anderson defined his trees in terms of two operations, `skew` and `split`. The `skew` operation removes a left link if such a link exists, and leaves the tree unmodified otherwise:

```
Node skew(Node nodeY) {
  if (nodeY != Node.nil && nodeY.children[0].level == nodeY.level) {
    Node nodeX = nodeY.children[0];
    Node nodeA = nodeY.children[0].children[0];
    Node nodeB = nodeY.children[0].children[1];
    Node nodeC = nodeY.children[1];
    nodeY.children[0].children[1] = nodeY;
    nodeY.children[0] = nodeB;
    return nodeX;
  } else {
    return nodeY;
  }
}
```
{: .language-java}

![Skew]({{ site.url }}/_downloads/2017/09/03/aa_skew.png "Skew")

On the other hand, the `split` operation increases the level of a node's right child, in case of two consecutive right links:

```
Node split(Node nodeX) {
  Node nodeY = nodeX.children[1];
  Node nodeZ = nodeY.children[1];
  if (nodeX != Node.nil
      && nodeY != Node.nil
      && nodeZ != Node.nil
      && nodeX.level == nodeY.level
      && nodeY.level == nodeZ.level) {
    Node nodeA = nodeX.children[0];
    Node nodeB = nodeY.children[0];
    Node nodeC = nodeZ.children[0];
    Node nodeD = nodeZ.children[1];
    nodeX.children[1] = nodeB;
    nodeY.children[0] = nodeX;
    ++nodeY.level;
    return nodeY;
  } else {
    return nodeX;
  }
}
```
{: .language-java}

![Split]({{ site.url }}/_downloads/2017/09/03/aa_split.png "Split")

Both operations are obviously constant time operations.

## Insertion

Inserting a value `k` in the tree works as follows: provided the value does not already exist in the tree, a new node is created with the value, and inserted where appropriate. A `skew` and a `split` are performed if necessary for the nodes on the path back to the root. This restores the invariants on the tree (this can likely be proven in a similar way as for 2-3 trees).

```
Node insert(Node root, int k) {
  if (root == Node.nil) {
    return new Node(k);
  }

  // Find the insertion point
  Node n = root;
  Node[] ns = new Node[32];
  int nsTop = 0;
  while (n.value != k) {
    ns[nsTop++] = n;
    if (n.value > k && n.children[0] != Node.nil) {
      n = n.children[0];
    } else if (n.value < k && n.children[1] != Node.nil) {
      n = n.children[1];
    } else {
      break;
    }
  }

  if (n.value == k) {
    return root;
  }

  // Rebalance on the way back to the root (1 skew, 1 split)
  Node nn = new Node(k);
  ns[nsTop - 1].children[ns[nsTop - 1].value > k ? 0 : 1] = nn;
  while (--nsTop >= 0) {
    int nside = nsTop > 0 ? ns[nsTop - 1].children[0] == ns[nsTop] ? 0 : 1 : 0;
    ns[nsTop] = skew(ns[nsTop]);
    ns[nsTop] = split(ns[nsTop]);
    if (nsTop > 0) {
      ns[nsTop - 1].children[nside] = ns[nsTop];
    }
  }

  return ns[0];
}
```
{: .language-java}

![Insert ]({{ site.url }}/_downloads/2017/09/03/aa_insert.png "Insert")

Overall, the insertion operation runs in logarithmic time.

## Deletion

Deleting a value `k` from the tree works as follows: the value is first looked up in the tree. Then, if the node that contains it has no children, it reference gets removed from its parent. If the node has no child or one child, its parent is linked with the child in question. Otherwise, if it has two children, its value is swapped with its inorder successor, which gets deleted according to one of the two previous cases. Rebalancing the tree requires three `skew`s and two `split`s for each node on the way back up to the root. This ensures that the invariants on the tree are restored (this can likely be proven in a similar way as for 2-3 trees).

```
Node delete(Node root, int k) {
  if (root == Node.nil) {
    return root;
  }

  // Find the node to delete
  Node n = root;
  Node[] ns = new Node[32];
  int nsTop = 0;
  while (n.value != k) {
    ns[nsTop++] = n;
    if (n.value > k && n.children[0] != Node.nil) {
      n = n.children[0];
    } else if (n.value < k && n.children[1] != Node.nil) {
      n = n.children[1];
    } else {
      break;
    }
  }

  if (n.value != k) {
    return root;
  }

  // If the node has no child or one child, link its parent with the child
  if (n.children[0] == Node.nil || n.children[1] == Node.nil) {
    int nside = n.children[1] == Node.nil ? 0 : 1;
    if (nsTop > 0) {
      ns[nsTop - 1].children[ns[nsTop - 1].children[0] == n ? 0 : 1] = n.children[nside];
    } else {
      root = n.children[nside];
    }
  }
  // Otherwise, replace its value by the value of its inorder successor, and delete the node that contained it
  else {
    ns[nsTop++] = n;
    Node nn = n.children[1];
    while (nn.children[0] != Node.nil) {
      ns[nsTop++] = nn;
      nn = nn.children[0];
    }
    n.value = nn.value;
    ns[nsTop - 1].children[ns[nsTop - 1].children[0] == nn ? 0 : 1] = nn.children[1];
  }

  // Rebalance on the way back to the root
  while (--nsTop >= 0) {
    Node nTop = ns[nsTop];

    // If the levels of the parent and the child differ by more than 1, rebalancing is needed
    if (ns[nsTop].children[0].level < ns[nsTop].level - 1
        || ns[nsTop].children[1].level < ns[nsTop].level - 1) {

      // Decrease the level of the parent. If this causes its right child to have a level larger than it, decrease it too
      if (ns[nsTop].children[1].level > --ns[nsTop].level) {
        --ns[nsTop].children[1].level;
      }

      // 3 skews, 2 splits
      ns[nsTop] = skew(ns[nsTop]);
      ns[nsTop].children[1] = skew(ns[nsTop].children[1]);
      ns[nsTop].children[1].children[1] = skew(ns[nsTop].children[1].children[1]);
      ns[nsTop] = split(ns[nsTop]);
      ns[nsTop].children[1] = split(ns[nsTop].children[1]);
    }

    if (nsTop > 0) {
      ns[nsTop - 1].children[ns[nsTop - 1].children[0] == nTop ? 0 : 1] = ns[nsTop];
    } else {
      root = ns[nsTop];
    }
  }

  return root;
}
```
{: .language-java}

![Delete]({{ site.url }}/_downloads/2017/09/03/aa_delete.png "Delete")

The deletion operation thus runs in logarithmic time too.

## Order statistics

Order statistics can easily be computed by adding a field to the nodes for tracking the size of their subtrees, and updating it during `split`s and `skew`s.

`rank` returns the number of entries in the tree that are smaller than the provided `value`:

```
int rank(Node root, int value) {
  int rank = 1;
  Node n = root;
  while (n != Node.nil) {
    if (n.value > value) {
      if (n.children[0] == Node.nil) {
        return rank;
      }
      n = n.children[0];
    } else if (n.value < value) {
      rank += n.children[0].size + n.occurrence;
      if (n.children[1] == Node.nil) {
        return rank;
      }
      n = n.children[1];
    } else {
      return rank + n.children[0].size;
    }
  }
  return rank;
}
```
{: .language-java}

`select` returns the node with the `i`-th smallest value:

```
Node select(Node root, int i) {
  Node n = root;
  while (n != Node.nil) {
    if (n.children[0].size < i && i <= n.children[0].size + n.occurrence) {
      return n;
    } else if (i <= n.children[0].size) {
      n = n.children[0];
    } else {
      i -= n.children[0].size + n.occurrence;
      n = n.children[1];
    }
  }
  throw new NoSuchElementException();
}
```
{: .language-java}

It can easily be seen that both operations run in logarithmic time.

# A practical example

Consider [problem 762 E](http://codeforces.com/problemset/problem/762/E) from Codeforces, where radio stations with different frequencies and ranges are aligned on a 1-dimensional line. The problem asks to find all pairs of stations that conflict with each other, i.e. that are within each other's range and whose frequencies interfere with each other.

Let `n` be the number of stations, `k` the maximum difference in  frequency for pairs of stations that reach each other to cause interferences and 'xrf', a 2-D array that contains the coordinates of the stations, the broadcast ranges, and the stations' respective frequencies. We would like to write a function `nConflictingStations` that takes those parameters as arguments, and return the number of interferring stations. Given that `k` is at most 10, this problem may be solved elegantly with the order-statistics tree presented above.

We start by sorting `xrf` in ascending order according to the stations' ranges. We then map the frequencies to AA trees that get populated with the stations' coordinates, and store the result in a `HashMap` `m`. Once this is done, we iterate again over `xrf`, and at each step, scan the station's interference band (`[frequency - k, frequency + k]`). For each frequency, we retrieve the associated tree if it exists, and count the number of stations that fall in the current station's range. This is done by using the `rank` operation on the AA tree. We then simply have to sum the number of such stations, making sure to remove each processed station from the tree.

```
long nConflictingStations(int n, int k, int[] x, int[] r, int[] f) {
  Arrays.sort(xrf, (xrfi1, xrfi2) -> Integer.compare(xrfi1[1], xrfi2[1]));
  Map<Integer, Node> m = new HashMap<>();
  for (int i = 0; i < n; ++i) {
    Node ftree = m.get(xrf[i][2]);
    if (ftree == null) {
      m.put(xrf[i][2], new Node(xrf[i][0]));
    } else {
      m.put(xrf[i][2], insert(ftree, xrf[i][0]));
    }
  }
  long bad = 0;
  for (int i = 0; i < n; ++i) {
    for (int fi = xrf[i][2] - k; fi <= xrf[i][2] + k; ++fi) {
      Node ftree = m.get(fi);
      if (ftree != null) {
        bad += rank(ftree, xrf[i][0] + xrf[i][1]) - rank(ftree, xrf[i][0] - xrf[i][1] - 1);
      }
      if (fi == xrf[i][2]) {
        --bad;
      }
    }
    m.put(xrf[i][2], delete(m.get(xrf[i][2]), xrf[i][0]));
  }
  return bad;
}
```
{: .language-java}

The problem can then be solved in `O(nk log(n))`, which is sufficent to meet the time bounds given the limits on the input parameters.

# Conclusion

In this article, I have implemented an AA tree, a simple self-balancing tree. Compared to RB trees, AA trees are arguably simpler to implement, and are particularly well suited to lookup-intensive settings. The implementation above avoids recursion, and is therefore slightly more verbose than the one presented in Anderson's original paper.

Happy hacking :)

# References

* [Completely Fair Scheduler - Wikipedia][1]
* [Performance Analysis of BSTs in System Software - Ben Pfaff][2]
* [When to use splay trees - Eric K. Lee, Charles U. Martel][3]
* [Balanced Search Trees Made Simple - Arne Andersson][4]

[1]: https://en.wikipedia.org/wiki/Completely_Fair_Scheduler
[2]: https://web.stanford.edu/~blp/papers/libavl.pdf
[3]: https://pdfs.semanticscholar.org/db5f/c9c57df48256e3baf3794c0c57926a76ba96.pdf
[4]: http://user.it.uu.se/~arnea/ps/simp.pdf
