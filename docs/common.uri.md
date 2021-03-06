<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@velcro/common](./common.md) &gt; [Uri](./common.uri.md)

## Uri class

Uniform Resource Identifier (URI) http://tools.ietf.org/html/rfc3986. This class is a simple parser which creates the basic component parts (http://tools.ietf.org/html/rfc3986\#section-3) with minimal validation and encoding.

```txt
      foo://example.com:8042/over/there?name=ferret#nose
      \_/   \______________/\_________/ \_________/ \__/
       |           |            |            |        |
    scheme     authority       path        query   fragment
       |   _____________________|__
      / \ /                        \
      urn:example:animal:ferret:nose

```

<b>Signature:</b>

```typescript
declare class Uri implements UriComponents 
```
<b>Implements:</b> UriComponents

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [authority](./common.uri.authority.md) |  | string | authority is the 'www.msft.com' part of 'http://www.msft.com/some/path?query\#fragment'. The part between the first double slashes and the next slash. |
|  [fragment](./common.uri.fragment.md) |  | string |  |
|  [fsPath](./common.uri.fspath.md) |  | string | Returns a string representing the corresponding file system path of this URI. platform specific path separator.<!-- -->\* Will \*not\* validate the path for invalid characters and semantics. \* Will \*not\* look at the scheme of this URI. \* The result shall \*not\* be used for display purposes but for accessing a file on disk.<!-- -->The \*difference\* to <code>URI#path</code> is the use of the platform specific separator and the handling
```ts
     const u = URI.parse('file://server/c$/folder/file.txt')
     u.authority === 'server'
     u.path === '/shares/c$/file.txt'
     u.fsPath === '\\server\c$\folder\file.txt'

```
Using <code>URI#path</code> to read a file (using fs-apis) would not be enough because parts of the path, namely the server name, would be missing. Therefore <code>URI#fsPath</code> exists - it's sugar to ease working with URIs that represent files on disk (<code>file</code> scheme). |
|  [path](./common.uri.path.md) |  | string | path is the '/some/path' part of 'http://www.msft.com/some/path?query\#fragment'. |
|  [query](./common.uri.query.md) |  | string | query is the 'query' part of 'http://www.msft.com/some/path?query\#fragment'. |
|  [scheme](./common.uri.scheme.md) |  | string | scheme is the 'http' part of 'http://www.msft.com/some/path?query\#fragment'. The part before the first colon. |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [ensureTrailingSlash(uri, trailingSlash)](./common.uri.ensuretrailingslash.md) | <code>static</code> |  |
|  [equals(l, r)](./common.uri.equals.md) | <code>static</code> |  |
|  [file(path)](./common.uri.file.md) | <code>static</code> | Creates a new URI from a file system path, e.g. <code>c:\my\files</code>, <code>/usr/home</code>, or <code>\\server\share\some\path</code>.<!-- -->The \*difference\* between <code>URI#parse</code> and <code>URI#file</code> is that the latter treats the argument as path, not as stringified-uri. E.g. <code>URI.file(path)</code> is \*\*not the same as\*\* <code>URI.parse('file://' + path)</code> because the path might contain characters that are interpreted (\# and ?). See the following sample:
```ts
     const good = URI.file('/coding/c#/project1');
     good.scheme === 'file';
     good.path === '/coding/c#/project1';
     good.fragment === '';
     const bad = URI.parse('file://' + '/coding/c#/project1');
     bad.scheme === 'file';
     bad.path === '/coding/c'; // path is now broken
     bad.fragment === '/project1';

```
 |
|  [from(components)](./common.uri.from.md) | <code>static</code> |  |
|  [getFirstPathSegmentAfterPrefix(child, parent)](./common.uri.getfirstpathsegmentafterprefix.md) | <code>static</code> |  |
|  [isPrefixOf(prefix, uri)](./common.uri.isprefixof.md) | <code>static</code> |  |
|  [isUri(thing)](./common.uri.isuri.md) | <code>static</code> |  |
|  [joinPath(uri, pathFragment)](./common.uri.joinpath.md) | <code>static</code> | Join a URI path with path fragments and normalizes the resulting path. |
|  [parse(value, \_strict)](./common.uri.parse.md) | <code>static</code> | Creates a new URI from a string, e.g. <code>http://www.msft.com/some/path</code>, <code>file:///usr/home</code>, or <code>scheme:with/path</code>. |
|  [revive(data)](./common.uri.revive.md) | <code>static</code> |  |
|  [revive(data)](./common.uri.revive_1.md) | <code>static</code> |  |
|  [revive(data)](./common.uri.revive_2.md) | <code>static</code> |  |
|  [revive(data)](./common.uri.revive_3.md) | <code>static</code> |  |
|  [toJSON()](./common.uri.tojson.md) |  |  |
|  [toString(skipEncoding)](./common.uri.tostring.md) |  | Creates a string representation for this URI. It's guaranteed that calling <code>URI.parse</code> with the result of this function creates an URI which is equal to this URI.<!-- -->\* The result shall \*not\* be used for display purposes but for externalization or transport. \* The result will be encoded using the percentage encoding and encoding happens mostly ignore the scheme-specific encoding rules. |
|  [with(change)](./common.uri.with.md) |  |  |

