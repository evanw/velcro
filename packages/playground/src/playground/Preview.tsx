import styled from '@emotion/styled/macro';
import { Bundle, InvariantViolation } from '@velcro/bundler';
import { CanceledError } from '@velcro/resolver';
import * as Monaco from 'monaco-editor';
import React, { useEffect, useRef, useContext, useState } from 'react';
import {
  Delayer,
  Throttler,
  DisposableStore,
  CancellationTokenSource,
  IDisposable,
  Emitter,
  Event,
  timeout,
} from 'ts-primitives';

import { EditorManagerContext } from '../lib/EditorManager';
import { TimeoutError } from '../lib/error';
import { HmrBuildErrorRequest, HmrReloadRequest, HmrReloadResponse } from '../lib/previewRuntime';

export interface DeferredExecutionModuleRecord {
  code: string;
  dependencies: Record<string, string>;
}

export interface DeferredExecutionManifest {
  aliases: Record<string, string>;
  entrypoints: Record<string, string>;
  modules: Record<string, DeferredExecutionModuleRecord>;
}

interface MessageLine {
  isInternal: boolean;
  text: string;
}
interface Message {
  lines: MessageLine[];
}

const PreviewProgress = styled.div<{ completed: number; total: number }>`
  z-index: 1;
  position: absolute;
  top: 0;
  width: ${props => (props.total ? `${Math.round((100 * props.completed) / props.total)}%` : 0)};
  left: 0;
  height: ${props => (props.total ? '2px' : '0')};
  background-color: #008cba;
  transition: width 0.5s 0s cubic-bezier(0.455, 0.03, 0.515, 0.955);
`;
const PreviewIframeWrap = styled.div`
  position: relative;
  overflow: hidden;

  & > iframe {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border: none;
    width: 100%;
    height: 100%;
  }
`;
const PreviewWrap = styled.div`
  position: relative;
  background: white;

  ${PreviewIframeWrap} {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
  }
`;
const PreviewMessageError = styled.ul`
  margin: 0;
  padding: 1em 2em;
  font-family: monospace;
  font-size: 16px;
  background-color: rgba(255, 0, 0, 0.5);
  backdrop-filter: brightness(50%);
  color: white;
  list-style: none;
`;
const PreviewMessageErrorText = styled.li<{ isInternal: boolean }>`
  white-space: pre-wrap;
  opacity: ${props => (props.isInternal ? 0.7 : 1.0)};
`;
const PreviewMessages = styled.div`
  z-index: 1;
  position: absolute;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column-reverse;
`;
const PreviewMessageLine: React.FC<{ line: MessageLine }> = ({ line }) => {
  return <PreviewMessageErrorText isInternal={line.isInternal}>{line.text}</PreviewMessageErrorText>;
};
const PreviewMessage: React.FC<{ message: Message }> = ({ message }) => {
  return message.lines.length ? (
    <PreviewMessageError>
      {message.lines.map((line, i) => (
        <PreviewMessageLine key={i} line={line}></PreviewMessageLine>
      ))}
    </PreviewMessageError>
  ) : null;
};

const Preview: React.FC<{ className?: string }> = props => {
  const invalidations = useRef(new Set<string>());
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const hmrClientRef = useRef<HmrClient | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const editorManager = useContext(EditorManagerContext);
  const [messages, setMessages] = useState([] as Message[]);
  const [buildProgress, setBuildProgress] = useState({ completed: 0, total: 0 });
  const runtimeBundleString = useRef('');

  useEffect(() => {
    const disposable = new DisposableStore();
    const delayer = new Delayer(500);
    const throttler = new Throttler();

    let tokenSource = new CancellationTokenSource();

    const queueRefreshPreview = (uris: string[]) => {
      tokenSource.cancel();
      tokenSource.dispose();

      tokenSource = new CancellationTokenSource();

      for (const uri of uris) {
        invalidations.current.add(uri);
      }

      delayer.trigger(() => throttler.queue(() => refreshPreview(tokenSource.token)));
    };

    const refreshPreview = async (token: Monaco.CancellationToken) => {
      const toInvalidate = Array.from(invalidations.current);

      setMessages([]);

      invalidations.current.clear();

      setBuildProgress({ completed: 0, total: 0 });

      let building = true;

      try {
        if (!runtimeBundleString.current) {
          const runtimeBundle = await editorManager.previewBundler.generateBundle(
            [`${editorManager.previewRuntimeHost.getRoot()}index.js`],
            {
              onCompleteAsset: () => {
                if (building) {
                  setBuildProgress(buildProgress => {
                    return {
                      completed: buildProgress.completed + 1,
                      total: buildProgress.total,
                    };
                  });
                }
              },
              onEnqueueAsset: () => {
                if (building) {
                  setBuildProgress(buildProgress => {
                    return {
                      completed: buildProgress.completed,
                      total: buildProgress.total + 1,
                    };
                  });
                }
              },
              token,
            }
          );

          runtimeBundleString.current = runtimeBundle.toString({ executeEntrypoints: true, sourceMap: false });
        }

        let build: Bundle | Error;

        try {
          const unresolvedEntrypointHref = Monaco.Uri.file('/').toString(true);
          const resolvedEntrypoint = await editorManager.bundler.resolver.resolve(unresolvedEntrypointHref);

          if (!resolvedEntrypoint.resolvedUrl) {
            throw new Error(`Unable to determine the entrypoing to your code`);
          }

          const resolvedEntrypointHref = resolvedEntrypoint.resolvedUrl.href;

          build = await editorManager.bundler.generateBundle([resolvedEntrypointHref], {
            invalidations: toInvalidate,
            onCompleteAsset: () => {
              if (building) {
                setBuildProgress(buildProgress => {
                  return {
                    completed: buildProgress.completed + 1,
                    total: buildProgress.total,
                  };
                });
              }
            },
            onEnqueueAsset: () => {
              if (building) {
                setBuildProgress(buildProgress => {
                  return {
                    completed: buildProgress.completed,
                    total: buildProgress.total + 1,
                  };
                });
              }
            },
            token,
          });
        } catch (err) {
          build = err;
        }

        if (hmrClientRef.current) {
          if (build instanceof CanceledError || (build instanceof Error && build.name === 'CanceledError')) {
            return;
          } else if (build instanceof Error) {
            hmrClientRef.current.send({
              type: 'build_error',
              message: build.message,
              stack: build.stack,
            });
          } else {
            const updatedBundleFile = new File(
              [build.toString({ executeEntrypoints: false, runtime: '__velcroRuntime', sourceMap: true })],
              'playground:///runtime.js',
              {
                type: 'text/javascript',
              }
            );
            const updatedBundleHref = URL.createObjectURL(updatedBundleFile);

            hmrClientRef.current.send({
              type: 'reload',
              invalidations: toInvalidate,
              href: updatedBundleHref,
            });
          }

          await Promise.race([
            Event.toPromise(hmrClientRef.current.onReload),
            timeout(5000).then(() => {
              throw new TimeoutError(`HMR refresh timed out`);
            }),
          ]);
        } else {
          let bundledCode: string;

          if (build instanceof Error) {
            bundledCode = `ReactErrorOverlay.reportBuildError(${JSON.stringify(build.message)});\n`;
          } else {
            bundledCode = `__velcroRuntime = ${build.toString({ executeEntrypoints: true, sourceMap: true })}`;
          }

          const runtimeFile = new File([runtimeBundleString.current], 'playground:///runtime.js', {
            type: 'text/javascript',
          });
          const bundleFile = new File([bundledCode], 'playground:///index.js', {
            type: 'text/javascript',
          });
          const markup = new File(
            [
              `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="ie=edge">
<title>Document</title>
<script src="${URL.createObjectURL(runtimeFile)}"></script>
</head>
<body>
<div id="root"></div>
<script src="${URL.createObjectURL(bundleFile)}"></script>
</body>
</html>`,
            ],
            Monaco.Uri.file('/index.html').toString(true),
            {
              type: 'text/html',
            }
          );
          const htmlUrl = URL.createObjectURL(markup);
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = htmlUrl;

          if (previewWrapRef.current) {
            previewWrapRef.current.appendChild(iframe);
          }

          try {
            await new Promise((resolve, reject) => {
              iframe.onload = () => resolve();
              iframe.onerror = reject;
            });

            if (previewIframeRef.current) {
              previewIframeRef.current.remove();
            }

            iframe.style.display = '';

            previewIframeRef.current = iframe;
          } catch (err) {
            iframe.remove();

            throw err;
          }
        }
      } catch (err) {
        tokenSource.cancel();

        if (!(err instanceof CanceledError) && (err && err.name !== 'CanceledError')) {
          setMessages(messages => [...messages, { lines: [{ isInternal: false, text: err.message }] }]);
        }
      } finally {
        if (tokenSource) {
          tokenSource.dispose();
        }

        building = false;

        setBuildProgress({ completed: 0, total: 0 });
      }
    };

    disposable.add(delayer);

    for (const model of Monaco.editor.getModels()) {
      disposable.add(
        model.onDidChangeContent(() => {
          queueRefreshPreview([model.uri.toString(true)]);
        })
      );
    }

    disposable.add(
      Monaco.editor.onDidCreateModel(model => {
        queueRefreshPreview([model.uri.toString(true)]);

        disposable.add(
          model.onDidChangeContent(() => {
            queueRefreshPreview([model.uri.toString(true)]);
          })
        );
      })
    );

    disposable.add(
      Monaco.editor.onWillDisposeModel(model => {
        queueRefreshPreview([model.uri.toString(true)]);
      })
    );

    disposable.add(
      (() => {
        const onMessage = async (e: MessageEvent) => {
          if (
            (previewIframeRef.current && e.source !== previewIframeRef.current.contentWindow) ||
            !e.data ||
            typeof e.data.type !== 'string' ||
            !e.data.payload
          ) {
            return;
          }

          switch (e.data.type) {
            case 'error_open': {
              if (!editorManager.editor) {
                return;
              }

              const model = editorManager.getModelByHref(e.data.payload.fileName);

              if (model) {
                let lineNumber: number | undefined = e.data.payload.lineNumber;
                let columnNumber: number | undefined = undefined;

                if (lineNumber !== undefined) {
                  const row = model.getLineContent(lineNumber);
                  const matches = row.match(/^(\s*)/);

                  columnNumber = matches ? matches[1].length + 1 : undefined;
                }

                editorManager.focusModel(model, {
                  lineNumber,
                  columnNumber,
                });
              }

              break;
            }
            case 'hmr_ready': {
              if (!(e.data.payload instanceof MessagePort)) {
                console.warn(
                  'Received "hmr_ready" message from preview but did not receive the expected MessagePort payload',
                  e.data
                );
                return;
              }

              hmrClientRef.current = new HmrClient(e.data.payload);
              break;
            }
            default: {
              console.debug({ message: e.data }, 'Unknown message received from preview iframe');
            }
          }
        };

        window.addEventListener('message', onMessage);
        return {
          dispose() {
            window.removeEventListener('message', onMessage);
          },
        };
      })()
    );

    disposable.add({
      dispose() {
        if (hmrClientRef.current) {
          hmrClientRef.current.dispose();
        }
      },
    });

    queueRefreshPreview([]);

    return () => disposable.dispose();
  }, [editorManager.bundler, editorManager, invalidations]);

  return (
    <PreviewWrap className={props.className}>
      <PreviewProgress completed={buildProgress.completed} total={buildProgress.total}></PreviewProgress>
      {previewIframeRef.current ? null : 'Building the preview...'}
      <PreviewIframeWrap ref={previewWrapRef}></PreviewIframeWrap>
      <PreviewMessages>
        {messages.map((message, idx) => (
          <PreviewMessage key={idx} message={message}></PreviewMessage>
        ))}
      </PreviewMessages>
    </PreviewWrap>
  );
};

export default styled(Preview)``;

class HmrClient implements IDisposable {
  private readonly onReloadEmitter = new Emitter<HmrReloadResponse>();

  constructor(private readonly port: MessagePort) {
    port.onmessage = e => {
      if (!e.data || typeof e.data !== 'object') {
        throw new InvariantViolation('Unexpected message received from HMR client');
      }

      switch (e.data.type) {
        case 'reload': {
          this.onReloadEmitter.fire(e.data);
          break;
        }
        default: {
          throw new InvariantViolation(`Unexpected message with type '${e.data.type}' received from HMR client`);
        }
      }
    };
  }

  get onReload() {
    return this.onReloadEmitter.event;
  }

  dispose() {
    this.port.close();
  }

  send(message: HmrBuildErrorRequest | HmrReloadRequest) {
    this.port.postMessage(message);
  }
}
