<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@velcro/common](./common.md) &gt; [Uri](./common.uri.md) &gt; [toString](./common.uri.tostring.md)

## Uri.toString() method

Creates a string representation for this URI. It's guaranteed that calling `URI.parse` with the result of this function creates an URI which is equal to this URI.

\* The result shall \*not\* be used for display purposes but for externalization or transport. \* The result will be encoded using the percentage encoding and encoding happens mostly ignore the scheme-specific encoding rules.

<b>Signature:</b>

```typescript
toString(skipEncoding?: boolean): string;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  skipEncoding | boolean | Do not encode the result, default is <code>false</code> |

<b>Returns:</b>

string

