---
author: Jean André Gauthier
date: 2018-05-05 23:11:48
featured_image: ./post_header.png
summary: "In this article, I present a proof concept for a search engine that identifies songs playing nearby. With ambient noise 5 times louder than the song being played, the engine is able to identify 4 out of 5 songs in 10 seconds on average."
tags:
- algorithms
- signal-processing
- scala
title: 'FindSong: A simple yet powerful audio search engine'
---

I regularly attend salsa dance evenings, and lately, I have been using a popular audio search app a lot. I would just open the app, tap the record button, and the app would display the title of the song the DJ was playing.

Of course, this spurred my interest, and I wondered how the app's algorithm looked like. With the current craze about machine learning, I immediately thought about neural networks. But to my great surprise, the algorithm described in original paper about the app [1] merely used signal processing techniques. I therefore challenged myself to write a small proof-of-concept, and to check whether my implementation of the algorithm would have a reasonable recognition rate.

The remainder of this article is organised as follows: in the first part, I'll give a short recap about signal processing, in the second part I'll describe the indexing algorithm, and in the third part I'll describe the matching algorithm. Lastly, I'll present some experiments that measure the search engine's recognition rate and speed. All of the code is open source and available on my [github account](https://github.com/jean-andre-gauthier/findsong).

# Signal Processing Basics

In physics, sound is a wave of pressure that travels through a medium such as air or water. The wave of pressure induces an oscillation of the medium's particles, which stimulates auditory nerves. In mathematical terms, sound can be modelled as a function that maps time to amplitude. This is called the function's *time domain*.

This continuous signal then usually gets transformed into a discrete signal for further processing, a process called *digitisation*. *Sampling* records the signal's values at regular time intervals, and *quantisation* maps the *samples* thus obtained to a finite set of values. Since continuous signals are of limited use for the analyses below, I'll simply use *signal* to refer to discrete signals.

{% raw %}<img alt="Signal digitisation" class="materialboxed" src="./01_digitisation.png" width="640">{% endraw %}

The signal's *frequency domain* is an alternative representation of the time domain. The latter maps time to amplitude, and the former frequency to amplitude.

A signal expressed in the time domain can be transformed to an equivalent representation in the frequency domain with a *discrete Fourier transform*. The algorithm that is commonly used for this operation is called *fast Fourier transform* (FFT). When applied to a sequence of samples, the FFT returns a sequence of complex numbers. Their magnitude represent the amplitude of the component, and the combination of their real and imaginary parts the phase of that component.

{% raw %}<img alt="Fast Fourier Transform" class="materialboxed" src="./02_fft.png" width="640">{% endraw %}

Implementation details for the FFT algorithm are beyond the scope of this article, but the interested reader may refer to [^7].

# Indexing

An elegant solution for audio search is to use a two phase algorithm. In the first phase, fingerprints are extracted from each song in the library and stored in an index. In the second phase, recordings are matched against the index in order to retrieve the song that has most likely been recorded. Obviously, such a search engine can only recognise songs that have been indexed before.



Audio search is complicated by the fact that recordings tend to be done in noisy environments such as bars or cafés. The fingerprinting algorithm should therefore have the following properties:

* *Noise tolerance*, for the above reason.
* *Time invariance and translation invariance*, since the app's users may record any portion of the song. Fingerprints should be independent from their offset in the recording, and not be affected by temporally distant parts of the song.
* The "right" amount of *entropy* in its fingerprints. Not enough entropy would lead to spurious matches, and too much would make it difficult to match noisy or distorted recordings.

It turns out that hashing spectrogram peak pairs on sliding windows satisfies most of the requirements above. Put differently, the indexer proceeds as follows:

{% raw %}
<pre>
1 -&gt; extract signal from audio file
2 -&gt; divide signal in chunks, compute spectrogram for each of them
3 -&gt; retrieve spectrogram peaks from array of spectrograms
4 -&gt; pair up nearby spectrogram peaks
5 -&gt; hash peak pairs and insert them in index
</pre>
{% endraw %}

## Signal extraction

Signal extraction is straightforward per se, but extracting signals from a a song library with heterogenous formats and sampling rates can be challenging. The most pragmatic approach is to use a library such as [ffmpeg](https://www.ffmpeg.org) to transform all files to a common file format with identical sample rates, channels and codecs. The [WAV format](http://tiny.systems/software/soundProgrammer/WavFormatDocs.pdf) is an ideal candidate for the intermediary file format, as it essentially consists of raw signal data, apart from an initial 44-byte header. High-frequency components above 4000Hz are not essential for song identification and therefore, by the [Nyquist-Shannon theorem](https://en.wikipedia.org/wiki/Nyquist–Shannon_sampling_theorem), a sample rate of 8000Hz is sufficient to guarantee perfect reconstruction of the original wave. Multiple channels are not essential for song identification either, suggesting that they can be merged into a mono channel. Lastly, the bit depth should be 16 bits at least, in order to avoid audible quantisation noise. Once the transcoding done, the raw signals can be read into an in-memory buffer for further processing. The reference implementation that can be found [here](https://github.com/jean-andre-gauthier/findsong/blob/f7601c164edff480d0cf567023dbd5ea70050fab/src/main/scala/ja/gauthier/findsong/AudioFile.scala#L47) also removes the [DC Bias](https://en.wikipedia.org/wiki/DC_bias) during this processing step, as it is just a matter of an additional flag for ffmpeg.

## Spectrograms

The goal of the next processing step is to extract a heatmap with the signal's frequencies. This is achieved by sliding a fixed-length window over the signal, and computing a fast Fourier transform on each data chunk. A window size of 1024 samples and an overlap of 512 samples can be used as sensible default values for a frequency of 8000Hz. The contents of the window are hanned before an FFT is computed on them, in order to reduce the effects induced by [spectral leakage](https://en.wikipedia.org/wiki/Spectral_leakage), i.e. the apparition of frequencies that do not exist in the original signal:

{% raw %}
<pre><code class="scala">def signalToSpectrogram(signal: Signal)(
    implicit settings: Settings): Spectrogram = {
  val raggedChunks = signal
    .map(_.toDouble)
    .sliding(settings.Spectrogram.samplesPerChunk,
             settings.Spectrogram.samplesPerChunkStep)
    .toArray
  val chunks =
    if (raggedChunks.size &gt; 0
        && raggedChunks.last.size != settings.Spectrogram.samplesPerChunk) {
      raggedChunks.init
    } else {
      raggedChunks
    }
  val chunksMatrix = if (chunks.size &gt; 0) {
    JavaArrayOps.array2DToDm(chunks)
  } else {
    new DenseMatrix[Double](0, 0)
  }
  val windowedSignal = hannFunction(chunksMatrix)
  val spectrogram = windowedSignal(*, ::).map(row =&gt; {
    val frequencies = fourierTr(row)
    frequencies(0 until row.size / 2).map(_.abs.round.toInt)
  })
  spectrogram
}

def hannFunction(
    signals: DenseMatrix[Double]): DenseMatrix[Double] = {
  signals :* (0.5 * (1.0 - cos(2.0 * Pi * signals.mapPairs((rowColumn, _) =&gt;
    rowColumn._2.toDouble) / (signals.cols - 1.0))))
}

type Signal = Array[Short]
type Spectrogram = breeze.linalg.DenseMatrix[Int]
</code></pre>
{% endraw %}

$\text{raggedChunks}$ can be computed in $\mathcal{O}(\frac{n - s}{t} \cdot s)$, where $n$ is the number of signal samples, $s = \text{samplesPerChunk}$ and $t = \text{samplesPerChunkStep}$. Assuming $s \ll n$ and $t \ll n$, this step's complexity is $\mathcal{O}(n)$. Obviously, $\text{chunks}$, $\text{chunksMatrix}$ and $\text{windowedSignal}$ also require $\mathcal{O}(n)$ operations. Since there are $\left \lfloor{\frac{n - s}{t} \cdot s}\right \rfloor$ chunks and the FFT is taken on a window of size $s$, calculating $\text{spectrogram}$ takes $\mathcal{O}(\left \lfloor{\frac{n - s}{t} \cdot s}\right \rfloor \cdot s \log{s})$, or $\mathcal{O}(n)$ with the assumptions above. Therefore, the running time of $\text{signalToSpectrogram}$ is $\mathcal{O}(n)$.

## Spectrogram Peaks

The array of spectrograms thus obtained can be viewed as a bidimensional heatmap, with peaks in the map being high energy frequencies in the song. The map is indexed by frequency bins on its x-axis, and chunk indexes on its y-axis. A point $(x, y)$ is considered to be a peak if no other point has a higher amplitude in the rectangular area $[x - \Delta f, x + \Delta f], [y - \Delta t, y + \Delta t]$. There may be several peaks in the same chunk, but only the $p = \text{peaksPerChunk}$ loudest ones will be considered for further processing. This prevents peak clusters from degrading the matcher's performance, as they tend to increase the number of false positive matches. $\Delta f$, $\Delta t$ and $p$ can be set to 4, 4 and 2 respectively.

{% raw %}<img alt="Constellation Map" class="materialboxed" src="./03_constellation_map.png" width="640">{% endraw %}

The peaks thus obtained are stored in an R-Tree for further processing; all other data points are discarded. The image above shows an extract of such a constellation map, with frequency bins on the x-axis and chunk indexes on the y-axis.

{% raw %}
<pre><code class="scala">def spectrogramToConstellationMap(spectrogram: Spectrogram)(
    implicit settings: Settings): ConstellationMap = {
  val indices = spectrogram
    .mapPairs((rowColumn, _) =&gt; rowColumn)
  val peaks = indices(*, ::)
    .map(_.toArray
      .flatMap((rowColumn) =&gt; {
        val peak = Peak(spectrogram(rowColumn._1, rowColumn._2),
                        rowColumn._2,
                        rowColumn._1)
        val peakDeltaF = settings.ConstellationMap.peakDeltaF
        val rangeCols = scala.math
          .max(0, peak.frequency - peakDeltaF)
          .to(
            scala.math.min(spectrogram.cols - 1, peak.frequency + peakDeltaF))
        val peakDeltaT = settings.ConstellationMap.peakDeltaT
        val rangeRows = scala.math
          .max(0, peak.time - peakDeltaT)
          .to(scala.math.min(spectrogram.rows - 1, peak.time + peakDeltaT))

        if (peak.amplitude == spectrogram(rangeRows, rangeCols).max)
          Some(peak)
        else
          None
      }))
    .toArray
  val peaksAboveThreshold = peaks
    .map(_.sorted.take(settings.ConstellationMap.peaksPerChunk))
  val constellationMap = peaksAboveThreshold.flatten.toArray
    .foldLeft(RTree.create[Peak, Point])((tree, peak) =&gt;
      tree.add(peak, Geometries.point(peak.time, peak.frequency)))
  constellationMap
}

case class Peak(amplitude: Int, frequency: Int, time: Int)
    extends Ordered[Peak] {
  def compare(that: Peak): Int =
    Ordering
      .Tuple3[Int, Int, Int]
      .compare(
        (-this.amplitude, this.time, this.frequency),
        (-that.amplitude, that.time, that.frequency)
      )
}

type ConstellationMap = RTree[Peak, Point]
</code></pre>
{% endraw %}

In the last section we showed that the number of entries in the spectogram growed linearly with the number of signal samples. Therefore, $\text{indices}$ can be computed in $\mathcal{O}(n)$. The algorithm then iterates over $2 \Delta f 2 \Delta t$ elements for each of the $s \cdot n$ entries in the map. Assuming $\Delta f \ll n$ and $\Delta t \ll n$, `peaks` can be computed in $\mathcal{O}(n)$. `peaksAboveThreshold` then obviously takes $\mathcal{O}(n \cdot s\log(s))$, which is linear given the assumptions above. Assuming a logarithmic insertion time in the tree, `constellationMap` can then be built in $\mathcal{O}(\sum_{i=1}^{p \cdot n} \log{i})$, or $\mathcal{O}(n \log{n})$. Hence, `spectrogramToConstellationMap` runs in $\mathcal{O}(n \log{n})$.

## Peak Pairs

A constellation map stores peaks that have survived thresholding as entries of a range query tree, which speeds up the peak pairing process. Candidate peaks are looked for in the area $[\text{peak.x} + \Delta \text{ti}, \text{peak.y} - \Delta f],$ $[\text{peak.x} + \Delta t, \text{peak.y} + \Delta f]$, at most $f = \text{fanout}$ of them being considered for each peak. This trades index size for peak survivability, i.e. the probability of a spectrogram peak surviving the whole indexing process. $f$ can be set to 3 for example.

{% raw %}
<pre><code class="scala">def constellationMapToPeakPairs(constellationMap: ConstellationMap)(
      implicit settings: Settings): PeakPairs = {
    val peakEntries = constellationMap.entries
      .toBlocking()
      .toIterable()
      .asScala
    val peakPairs = peakEntries
      .flatMap(
        peakEntry =&gt;
          constellationMap
            .search(Geometries.rectangle(
              peakEntry.geometry.x() + settings.PeakPairs.windowDeltaTi,
              peakEntry.geometry.y() - settings.PeakPairs.windowDeltaF,
              peakEntry.geometry.x() + settings.PeakPairs.windowDeltaT,
              peakEntry.geometry.y() + settings.PeakPairs.windowDeltaF
            ))
            .toBlocking()
            .toIterable()
            .asScala
            .toSeq
            .map(_.value())
            .sorted
            .take(settings.PeakPairs.fanout)
            .map(otherPeak =&gt;
              if (peakEntry.value().time &lt;= otherPeak.time)
                (peakEntry.value(), otherPeak)
              else
                (otherPeak, peakEntry.value())))
      .toSeq
    peakPairs
}
</code></pre>
{% endraw %}

Assuming a logarithmic lookup time in the range tree and $\mathcal{O}(n)$ entries in it, computing `peakPairs` takes $\mathcal{O}(n \log{n})$. The resulting list then contains $\mathcal{O}(f \cdot n)$ elements.

## Insertion in the index

The last step for the indexer is to hash the peaks and insert them in the index. $(\text{peak1.f}, \text{peak2.f}, \text{peak2.t} - \text{peak1.t})$ is used as the key, and $(\text{peak1.t}, \text{song})$ as value. Defining the key in that way allows for a quick lookup of peaks with identical frequencies at matching time. The difference between the time indexes is stored in the key instead of absolute time indexes, since the matcher has to recognise recordings independently from their position in the song. Nevertheless, the first peak's absolute time index is stored along with the song metadata, as the matcher is going to compute a histogram of time offsets and deduce the best matching song.

{% raw %}
<pre><code class="scala">def peakPairsToSongIndex(peakPairs: PeakPairs, song: Song)(
      implicit settings: Settings): SongIndex = {
    val songIndexUnsortedValues = peakPairs
      .foldLeft(SongIndex())((songIndex, peakPair) =&gt; {
        val key = SongIndexKey(peakPair._1.frequency,
                               peakPair._2.frequency,
                               peakPair._2.time - peakPair._1.time)
        val values = songIndex
          .getOrElse(key, Seq.empty[SongIndexValue]) :+ SongIndexValue(
          peakPair._1.time,
          song)
        songIndex + (key -&gt; values)
      })
    val songIndexSortedValues =
      songIndexUnsortedValues.mapValues(_.sortBy(_.t1))
    songIndexSortedValues
  }
</code></pre>
{% endraw %}

Assuming there are $n$ elements in `peakPairs` and a negligible number of collisions in the index, `songIndexUnsortedValues` and `songIndexSortedValues` can be computed in $\mathcal{O}(n)$.

The total indexing complexity is $\mathcal{O}(n \log{n})$ with respect to the signal size. Building the constellation map is the computationally most expensive step:

| Operation                           | Complexity               |
| ----------------------------------- | ------------------------ |
| Signal &rArr; Spectrogram           | $\mathcal{O}(n)$         |
| Spectrogram &rArr; ConstellationMap | $\mathcal{O}(n \log{n})$ |
| ConstellationMap &rArr; PeakPairs   | $\mathcal{O}(n)$         |
| PeakPairs &rArr; SongIndex          | $\mathcal{O}(n)$         |
| *Total*                             | $\mathcal{O}(n \log{n})$ |

# Matching

## Song Offsets

The matching algorithm extracts peak pairs from the recorded clip similarly to the indexig algorithm. For each peak pair, the matcher then looks up the index and retrieves all values with identical frequencies and time offset.

{% raw %}
<pre><code class="scala">def peakPairsToSongOffsets(peakPairs: PeakPairs,
                                 songIndex: SongIndex): SongOffsets = {
  val songOffsets =
    peakPairs.foldLeft(SongOffsets())((songOffsetsMap, peakPair) => {
      val songIndexValues = songIndex.get(
        SongIndexKey(peakPair._1.frequency,
                     peakPair._2.frequency,
                     peakPair._2.time - peakPair._1.time))
      songIndexValues match {
        case Some(values) =>
          val songOffsetsEntries = songOffsetsMap.toSeq ++ values.flatMap(
            (value) => {
              val offset = value.t1 - peakPair._1.time
              if (offset >= 0)
                Some(value.song -> Seq(offset))
              else
                None
            })
          songOffsetsEntries.groupBy(_._1).mapValues(_.flatMap(_._2))
        case None => songOffsetsMap
      }
    })
  songOffsets
}
</code></pre>
{% endraw %}

## Song Confidence

{% raw %}
<pre><code class="scala">def songOffsetsToSongConfidence(songOffsets: SongOffsets)(
    implicit settings: Settings): SongConfidence = {
  val songConfidence = songOffsets
    .foldLeft(Map[Song, Double]())(
      (songToMaxOffsetOccurrenceMap, songOffsetsPair) => {
        val offsets =
          convert(new DenseVector(songOffsetsPair._2.toArray), Double)
        val offsetsMode = mode(offsets).frequency
        val score = math.tanh(
          offsetsMode / settings.Matching.scoreCoefficient.toDouble) * 100
        songToMaxOffsetOccurrenceMap + (songOffsetsPair._1 -> score)
      })
  songConfidence
}
</code></pre>
{% endraw %}

## Matches

{% raw %}
<pre><code class="scala">def songConfidenceToMatches(songConfidence: SongConfidence)(
      implicit settings: Settings): Matches = {
    val matches = songConfidence.toSeq
      .map((songConfidence) => Match(songConfidence._1, songConfidence._2))
      .sorted
      .take(settings.Matching.maxMatches)
    matches
  }
</code></pre>
{% endraw %}


# Experiments

| | 10 Songs | 100 Songs | 1000 Songs
| Indexing duration (s) |
| Index size (# entries) |
| Success rate quiet |
| Matching duration quiet (s) |
| Success rate noisy |
| Matching duration noisy (s) |

* Noisy environment
* Different versions of the same song / live recordings
* Pitch Shift
* EQ
* Mixing several tracks
* Time dilation

# Future Work

There is an important aspect that has not been addressed in this article, namely scalability. In a first step, the hash map used for the index should be replaced by a distributed hash table. This would have the advantage distributing the load

# Related work


## Other acoustic fingerprinting algorithms

# Conclusion


# References

[^1]: {% raw %}<a href="http://www.ee.columbia.edu/~dpwe/papers/Wang03-shazam.pdf">Wang, A., 2003, October. An Industrial Strength Audio Search Algorithm. In Ismir (Vol. 2003, pp. 7-13).</a>{% endraw %}
[^2]: {% raw %}<a href="https://www.youtube.com/watch?time_continue=18&v=WhXgpkQ8E-Q">Peter Sobot. (2015). PWLTO#11 – Peter Sobot on An Industrial-Strength Audio Search Algorithm. [Online Video]. 16 October 2015. Available from: https://www.youtube.com/watch?time_continue=18&v=WhXgpkQ8E-Q. [Accessed: 19 May 2018].</a>{% endraw %}
[^3]: {% raw %}<a href="https://medium.com/@treycoopermusic/how-shazam-works-d97135fb4582">Cooper, T. (2018). How Shazam Works. [Blog] Medium. Available at: https://medium.com/@treycoopermusic/how-shazam-works-d97135fb4582 [Accessed 19 May 2018].</a>{% endraw %}
[^4]: {% raw %}<a href="https://www.toptal.com/algorithms/shazam-it-music-processing-fingerprinting-and-recognition">Jovanovic, J. (2014). How does Shazam work? Music Recognition Algorithms, Fingerprinting, and Processing. [Blog] Toptal. Available at: https://www.toptal.com/algorithms/shazam-it-music-processing-fingerprinting-and-recognition [Accessed 19 May 2018].</a>{% endraw %}
[^5]: {% raw %}<a href="http://royvanrijn.com/blog/2010/06/creating-shazam-in-java/">Van Rijn, R. (2010). Creating Shazam in Java. [Blog] royvanrijn.com: blog of a programmer. Available at: http://royvanrijn.com/blog/2010/06/creating-shazam-in-java/ [Accessed 19 May 2018].</a>{% endraw %}
[^6]: {% raw %}<a href="https://www.princeton.edu/~cuff/ele201/files/lab2.pdf">Princeton ELE 201, Spring 2014, Laboratory No. 2, Shazam. (2014). [ebook] Princeton: Princeton University, pp.1-7. Available at: https://www.princeton.edu/~cuff/ele201/files/lab2.pdf [Accessed 19 May 2018].</a>{% endraw %}
[^7]: {% raw %}<a href="https://codeforces.com/blog/entry/43499">Tutorial on FFT/NTT — The tough made simple. ( Part 1 ). (2016). [Blog] Codeforces. Available at: https://codeforces.com/blog/entry/43499 [Accessed 19 May 2018].</a>{% endraw %}