import styles from '@pages/app.module.scss';
import tstyles from '@pages/table.module.scss';

import * as C from '@common/constants';
import * as R from '@common/requests';
import * as U from '@common/utilities';
import * as React from 'react';

import AuthenticatedLayout from '@components/AuthenticatedLayout';
import AuthenticatedSidebar from '@components/AuthenticatedSidebar';
import Button from '@components/Button';
import Navigation from '@components/Navigation';
import Page from '@components/Page';
import PageHeader from '@components/PageHeader';
import Cookie from 'js-cookie';

import { H2, P } from '@components/Typography';
import CopyButton from '@root/components/CopyButton';
import CreateKeyModalBody from '@root/components/CreateKeyModalBody';
import Modal from '@root/components/Modal';

export async function getServerSideProps(context) {
  const viewer = await U.getViewerFromHeader(context.req.headers);

  if (!viewer) {
    return {
      redirect: {
        permanent: false,
        destination: '/sign-in',
      },
    };
  }

  return {
    props: { viewer, api: process.env.NEXT_PUBLIC_ESTUARY_API, hostname: `https://${context.req.headers.host}` },
  };
}

const REDACTED_TOKEN_STRING = '•'.repeat(42);

function APIPage(props: any) {
  const viewerToken = Cookie.get(C.auth);

  const [state, setState] = React.useState({ keys: [], loading: false });
  const [showCreateKeyModal, setShowCreateKeyModal] = React.useState(false);
  const [showCreatePermanentKeyModal, setShowCreatePermanentKeyModal] = React.useState(false);

  React.useEffect(() => {
    const run = async () => {
      const response = await R.get('/user/api-keys', props.api);
      if (response && !response.error) {
        setState({ ...state, keys: response });
      }
    };

    run();
  }, [showCreateKeyModal, showCreatePermanentKeyModal]);

  const sidebarElement = <AuthenticatedSidebar active="API" viewer={props.viewer} />;

  return (
    <Page title="Estuary: API" description="Generate and manage your API keys." url={`${props.hostname}/api`}>
      <AuthenticatedLayout navigation={<Navigation isAuthenticated isRenderingSidebar={!!sidebarElement} />} sidebar={sidebarElement}>
        <PageHeader>
          <H2>API</H2>
          <P style={{ marginTop: 16 }}>Generate an API key or manage your existing keys</P>

          <div className={styles.actions}>
            <Button
              style={{
                marginBottom: 24,
                marginRight: 24,
              }}
              loading={state.loading ? state.loading : undefined}
              onClick={() => {
                setShowCreateKeyModal(true);
              }}
            >
              Create key
            </Button>
            {showCreateKeyModal && (
              <Modal
                title="Create Key"
                onClose={() => {
                  setShowCreateKeyModal(false);
                }}
                show={showCreateKeyModal}
              >
                <CreateKeyModalBody />
              </Modal>
            )}
            <Button
              style={{
                marginBottom: 24,
                marginRight: 24,
                background: 'var(--lightBlack)',
                color: 'var(--text-white)',
              }}
              loading={state.loading ? state.loading : undefined}
              onClick={() => {
                setShowCreatePermanentKeyModal(true);
              }}
            >
              Create permanent key
            </Button>
            {showCreatePermanentKeyModal && (
              <Modal
                title="Create Permanent Key"
                onClose={() => {
                  setShowCreatePermanentKeyModal(false);
                }}
                show={showCreatePermanentKeyModal}
              >
                <CreateKeyModalBody expiry={false} />
              </Modal>
            )}
            <Button
              style={{
                marginBottom: 24,
                marginRight: 24,
                background: 'var(--lightBlack)',
                color: 'var(--text-white)',
              }}
              loading={state.loading ? state.loading : undefined}
              onClick={async () => {
                setState({ ...state, loading: true });

                for await (const key of state.keys) {
                  try {
                    const expiryDate = new Date(key.expiry);
                    const currentDate = new Date();
                    const isExpired = expiryDate < currentDate;

                    if (viewerToken === key.token) {
                      continue;
                    }

                    if (isExpired) {
                      const response = await R.del(`/user/api-keys/${key.tokenHash ? key.tokenHash : key.token}`, props.api);
                    }
                  } catch (e) {
                    console.log(e);
                  }
                }

                const keys = await R.get('/user/api-keys', props.api);
                if (keys && !keys.error) {
                  setState({ ...state, keys, loading: false });
                }
              }}
            >
              Delete expired keys
            </Button>
          </div>
        </PageHeader>

        <div className={styles.group}>
          <table className={tstyles.table}>
            <tbody className={tstyles.tbody}>
              <tr className={tstyles.tr}>
                <th className={tstyles.th} style={{ width: '136px' }}>
                  Label
                </th>
                <th className={tstyles.th} style={{ width: '448px' }}>
                  Key
                </th>
                <th className={tstyles.th}>Expiry</th>
                <th className={tstyles.th} style={{ width: '152px' }}>
                  Options
                </th>
              </tr>
              {state.keys && state.keys.length
                ? state.keys
                    .filter((k) => !k.isSession)
                    .map((k, index) => {
                      const expiryDate = new Date(k.expiry);
                      const currentDate = new Date();
                      const isExpired = expiryDate < currentDate;

                      return (
                        <tr key={k.tokenHash ? k.tokenHash : k.token} className={tstyles.tr}>
                          <td style={{ opacity: isExpired ? 0.2 : 1 }} className={tstyles.td}>
                            {k.label}
                          </td>
                          <td style={{ opacity: isExpired ? 0.2 : 1 }} className={tstyles.td}>
                            {k.token ? k.token : REDACTED_TOKEN_STRING} {viewerToken === k.token ? <strong>(current browser session)</strong> : null}
                          </td>
                          <td style={{ opacity: isExpired ? 0.2 : 1 }} className={tstyles.td}>
                            {U.toDate(k.expiry)}
                          </td>
                          <td className={tstyles.td}>
                            <button
                              onClick={async () => {
                                const confirm = window.confirm('Are you sure you want to delete this key?');
                                if (!confirm) {
                                  return;
                                }

                                const response = await R.del(`/user/api-keys/${k.tokenHash ? k.tokenHash : k.token}`, props.api);
                                if (viewerToken === k.token) {
                                  window.location.href = '/';
                                  return;
                                }

                                const keys = await R.get('/user/api-keys', props.api);
                                if (keys && !keys.error) {
                                  setState({ ...state, keys });
                                }
                              }}
                              className={tstyles.tdbutton}
                            >
                              {isExpired ? 'Delete expired' : `Revoke`}
                            </button>
                            {!isExpired && k.token ? <CopyButton content={k.token} /> : null}
                          </td>
                        </tr>
                      );
                    })
                : null}
            </tbody>
          </table>
        </div>
      </AuthenticatedLayout>
    </Page>
  );
}

export default APIPage;
