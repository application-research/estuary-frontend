import styles from '@pages/app.module.scss';
import tstyles from '@pages/table.module.scss';

import * as React from 'react';
import * as U from '@common/utilities';
import * as R from '@common/requests';

import ProgressCard from '@components/ProgressCard';
import Navigation from '@components/Navigation';
import Page from '@components/Page';
import AuthenticatedLayout from '@components/AuthenticatedLayout';
import AuthenticatedSidebar from '@components/AuthenticatedSidebar';
import EmptyStatePlaceholder from '@components/EmptyStatePlaceholder';
import SingleColumnLayout from '@components/SingleColumnLayout';
import PageHeader from '@components/PageHeader';
import Button from '@components/Button';
import ActionRow from '@components/ActionRow';
import AlertPanel from '@components/AlertPanel';

import { H1, H2, H3, H4, P } from '@components/Typography';
import FilesTable from '@root/components/FilesTable';

const INCREMENT = 1000;

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
    props: { viewer, api: process.env.ESTUARY_API, hostname: `https://${context.req.headers.host}` },
  };
}

const getNext = async (state, setState, host) => {
  const offset = state.offset + INCREMENT;
  const limit = state.limit;
  const next = await R.get(`/content/stats?offset=${offset}&limit=${limit}`, host);

  if (!next || !next.length) {
    return;
  }

  setState({
    ...state,
    offset,
    limit,
    files: [...state.files, ...next],
  });
};

function HomePage(props: any) {
  const [state, setState] = React.useState({
    files: null,
    stats: null,
    offset: 0,
    limit: INCREMENT,
  });

  React.useEffect(() => {
    run();
  }, []);

  const sidebarElement = <AuthenticatedSidebar active="FILES" viewer={props.viewer} />;

  const updateFiles = () => {
    run();
  };

  const run = async () => {
    const files = await R.get(`/content/stats?offset=${state.offset}&limit=${state.limit}`, props.api);
    const stats = await R.get('/user/stats', props.api);

    if (files && !files.error) {
      setState({ ...state, files, stats });
    }
  };
  return (
    <Page title="Estuary: Home" description="Analytics about Filecoin and your data." url={`${props.hostname}/home`}>
      <AuthenticatedLayout navigation={<Navigation isAuthenticated isRenderingSidebar={!!sidebarElement} />} sidebar={sidebarElement}>
        {/* <AlertPanel title="Storage deals are experiencing delays">
          Currently Filecoin deals are experiencing delays that are effecting the accuracy of receipts and status reporting. We are waiting for patches in the Lotus implementation
          of Filecoin to be deployed by miners.
        </AlertPanel> */}

        {state.files && !state.files.length ? (
          <PageHeader>
            <H2>Upload public data</H2>
            <P style={{ marginTop: 16 }}>
              Uploading your public data to IPFS and backing it up on Filecoin is easy. <br />
              <br />
              Lets get started!
            </P>

            <div className={styles.actions}>
              <Button href="/upload">Upload your first file</Button>
            </div>
          </PageHeader>
        ) : (
          <PageHeader>
            <H2>Files</H2>
          </PageHeader>
        )}

        {state.stats ? (
          <div className={styles.group}>
            <table className={tstyles.table}>
              <tbody className={tstyles.tbody}>
                <tr className={tstyles.tr}>
                  <th className={tstyles.th}>Total size bytes</th>
                  <th className={tstyles.th}>Total size</th>
                  <th className={tstyles.th}>Total number of pins</th>
                </tr>
                <tr className={tstyles.tr}>
                  <td className={tstyles.td}>{U.formatNumber(state.stats.totalSize)}</td>
                  <td className={tstyles.td}>{U.bytesToSize(state.stats.totalSize)}</td>
                  <td className={tstyles.td}>{U.formatNumber(state.stats.numPins)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className={styles.group}>
          {state.files && state.files.length ? <FilesTable files={state.files} setFiles={updateFiles} /> : null}

          {state.files && state.offset + state.limit === state.files.length ? (
            <ActionRow style={{ paddingLeft: 16, paddingRight: 16 }} onClick={() => getNext(state, setState, props.api)}>
              ➝ Next {INCREMENT}
            </ActionRow>
          ) : null}
        </div>
      </AuthenticatedLayout>
    </Page>
  );
}

export default HomePage;
