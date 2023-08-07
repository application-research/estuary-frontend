import styles from '@pages/app.module.scss';

import * as C from '@common/constants';
import * as Crypto from '@common/crypto';
import * as U from '@common/utilities';
import * as React from 'react';

import Button from '@components/Button';
import Input from '@components/Input';
import Navigation from '@components/Navigation';
import Page from '@components/Page';
import SingleColumnLayout from '@components/SingleColumnLayout';
import Cookies from 'js-cookie';

import { H2, H3, H4, P } from '@components/Typography';
import Divider from '@components/Divider';

export async function getServerSideProps(context) {
  const viewer = await U.getViewerFromHeader(context.req.headers);
  const host = context.req.headers.host;
  const protocol = host.split(':')[0] === 'localhost' ? 'http' : 'https';

  if (viewer) {
    return {
      redirect: {
        permanent: false,
        destination: '/home',
      },
    };
  }

  return {
    props: { viewer, host, protocol, api: process.env.NEXT_PUBLIC_ESTUARY_API, hostname: `https://${host}` },
  };
}

async function handleRegisterWithMetaMask(state: any, host) {
  if (!window.ethereum) {
    alert('You must have MetaMask installed!');
    return;
  }

  if (U.isEmpty(state.inviteCode)) {
    return { error: 'Please provide your invite code.' };
  }

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

  if (window.ethereum.networkVersion !== C.network.chainId) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: C.network.chainId }],
      });
    } catch (err) {
      // This error code indicates that the chain has not been added to MetaMask
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [C.network],
        });
      }
    }
  }

  const authSvcHost = C.api.authSvcHost;
  let userCreationResp = await fetch(`${authSvcHost}/register-with-metamask`, {
    method: 'POST',
    body: JSON.stringify({
      address: accounts[0],
      inviteCode: state.inviteCode,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (userCreationResp.status !== 200) {
    const userCreationRespJson = await userCreationResp.json();
    if (!userCreationRespJson.details) {
      return { error: 'Our server failed to register your account. Please contact us.' };
    }
    return { error: userCreationRespJson.details };
  }

  let from = accounts[0];
  let timestamp = new Date().toLocaleString();

  let response = await fetch(`${authSvcHost}/generate-nonce`, {
    method: 'POST',
    body: JSON.stringify({ host, address: from, issuedAt: timestamp, chainId: parseInt(C.network.chainId), version: '1' }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const respJson = await response.json();
  if (response.status !== 200) {
    return { error: respJson.details };
  }

  if (respJson.error) {
    return respJson;
  }

  if (!respJson.nonceMsg) {
    return { error: 'No nonceMsg Generated' };
  }

  const msg = `0x${Buffer.from(respJson.nonceMsg, 'utf8').toString('hex')}`;

  let sign;
  try {
    sign = await window.ethereum.request({
      method: 'personal_sign',
      params: [msg, from, ''],
    });
  } catch (err) {
    return { error: err.message };
  }

  let r = await fetch(`${authSvcHost}/login-with-metamask`, {
    method: 'POST',
    body: JSON.stringify({ address: from, signature: sign }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await authRedirect(r);
}

async function handleRegister(state: any, host) {
  if (U.isEmpty(state.password)) {
    return { error: 'Please provide a valid password.' };
  }

  if (!U.isValidPassword(state.password)) {
    return {
      error: 'Please provide a password thats at least 8 characters with at least one letter and one number',
    };
  }

  // make sure this field isn't empty
  if (U.isEmpty(state.confirmPassword)) {
    return { error: 'Please enter your password again.' };
  }

  // add password confirmation
  if (!U.isValidPassword(state.confirmPassword || state.confirmPassword !== state.password)) {
    return {
      error: 'Passwords do not match',
    };
  }

  if (U.isEmpty(state.username)) {
    return { error: 'Please provide a username.' };
  }

  if (U.isEmpty(state.inviteCode)) {
    return { error: 'Please provide your invite code.' };
  }

  if (!U.isValidUsername(state.username)) {
    return {
      error: 'Your username must be 1-48 uppercase or lowercase characters or digits with no spaces.',
    };
  }

  let passwordHash = await Crypto.attemptHashWithSalt(state.password);

  let r = await fetch(`${host}/register`, {
    method: 'POST',
    body: JSON.stringify({
      passwordHash: passwordHash,
      username: state.username.toLowerCase(),
      inviteCode: state.inviteCode,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await authRedirect(r);
}

async function authRedirect(resp) {
  if (resp.status !== 200) {
    return { error: 'Our server failed to register your account. Please contact us.' };
  }

  const j = await resp.json();
  if (j.error) {
    return j;
  }

  if (!j.token) {
    return {
      error: 'Our server failed to register your account and sign you in. Please contact us.',
    };
  }

  Cookies.set(C.auth, j.token);
  window.location.href = '/home';
  return;
}

function SignUpPage(props: any) {
  const [state, setState] = React.useState({
    inviteCode: '',
    username: '',
    password: '',
    confirmPassword: '',
    loading: false,
    fissionLoading: false,
    metaMaskLoading: false,
  });

  const authorise = null;
  const authScenario = null;
  const signIn = null;

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite');

    if (!U.isEmpty(inviteCode)) {
      setState({ ...state, inviteCode });
    }
  }, []);

  return (
    <Page title="Estuary: Sign up" description="Create an account on Estuary with an invite key." url={`${props.hostname}/sign-up`}>
      <Navigation active="SIGN_UP" />
      <SingleColumnLayout style={{ maxWidth: 488 }}>
        <H2>Sign up</H2>
        <P style={{ marginTop: 16 }}>Disabled. Thanks for supporting our product over the years.</P>
      </SingleColumnLayout>
    </Page>
  );
}

export default SignUpPage;
