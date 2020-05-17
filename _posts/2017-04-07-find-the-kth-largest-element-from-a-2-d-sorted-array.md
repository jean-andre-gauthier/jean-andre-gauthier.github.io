---
layout: post
title:  "Find the kth largest element from a 2-d sorted array"
date:   2017-04-07 00:00:00 +0200
categories: algorithms
---
Finding the kth smallest element in a sorted array is trivial, but the problem becomes much trickier when extended to a sorted matrix. In this post, I'll present an algorithm that runs in linear time with respect to the number of items in the matrix.

A while back I came across [an interesting question](https://stackoverflow.com/questions/5940420/find-kth-largest-element-from-a-2-d-sorted-array/27194814#27194814) asked by a StackOverflow user: "I have a 2 dimensional array. The rows and columns are sorted. How to find the kth largest element from the 2-d array?" Unsatisfied by the answers that had been given, I did a bit of research and realised that the problem could be solved in linear time. As a reference, here is the answer I gave to the question:

There is actually an **O(n)** divide-and-conquer algorithm that solves the selection problem in a sorted matrix (i.e. finding the kth smallest element in a sorted matrix).

The authors of [Selection In X+Y and Matrices with Sorted Rows and Columns][1] originally proposed such an algorithm, but the way it works is not that intuitive. A simpler algorithm, the one presented below, can be found in [Selection in a sorted matrix][2].

**Definitions**: Assuming a sorted n x m matrix M, with n <= m and no duplicates, we can define a submatrix N such that N consists of all odd-numbered columns and the last column of M. The rank of an element e in a matrix M is defined as `rank(M,e) = |{M(i,j) | M(i,j) < e}|`.

**Main theorem**: The algorithm relies on the fact that if M is a sorted matrix, `2*rank(N,e) - 2n <= rank(M,e) <= 2*rank(N,e)`.

**Proof**: Taking `f(i) = min j s.t. M(i,j) >= e`, we can state that

```
    rank(M,e) = sum i=1 to n of f(i)
    rank(N,e) = sum i=1 to n of ceil(f(i)/2) <= rank(M,e)/2 + n
    => 2*rank(N,e) - 2n <= rank(M,e)
    rank(N,e) > sum i=1 to n of f(i)/2
    => rank(M,e) <= 2*rank(N,e)
```

**Conquer**: In other words, if we are to find an element with rank k in M, we would only have to look into in the submatrix P of M that is bounded by elements a and b such that `rank(N,a) = floor(k/2)` and `rank(N,b) = ceil(k/2) + n`. How many elements are in this submatrix? By the previous inequality and the assumption that there are no duplicates, so at most O(n). Therefore we just have to select the `k - rank(N,a)` th element in P, and this can be done by rearranging P into a sorted array in O(m), and then running a linear-time algorithm such as quickselect to find the actual element. `rank(M,a)` can be computed in O(m), starting from the smallest element in the matrix and iterating over the columns until an element larger than a is found, and then going to the next line and going to the previous column until we find the first element to be larger than a, etc. The conquer part thus runs in O(m).

**Divide**:  The only thing left to do is to find a and b such that `rank(N,a) = k/2` and `rank(N,b) = k/2 + n`. This can obviously be done recursively on N (whose size is divided by 2 with respect to M).

**Runtime analysis**: So all in all, we have an O(m) conquer algorithm. Taking `f(n,m)` as the complexity of the algorithm for an n x m matrix, with n <= m (if not the matrix could conceptually be rotated), we can establish the recurrence relation `f(m) = c*m + f(m/2)`. By the master theorem, since `f(1) = 1`, we find `f(n,m) = O(m)`. The whole algorithm has therefore a running time of O(m), which is O(n) In the case of a square matrix (this is n.b. also O(k), since we can confine the search to the k x k matrix containing the first k columns and rows). 

For the general case of a matrix with duplicates, one could tag the matrix' elements with the row and column numbers.

Happy hacking :)

[1]: http://www.cse.yorku.ca/~andy/pubs/X%2BY.pdf
[2]: http://www.chaoxuprime.com/posts/2014-04-02-selection-in-a-sorted-matrix.html