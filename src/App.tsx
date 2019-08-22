import React, { Component } from 'react';
import Autocomplete from 'react-autocomplete';
import './App.css';
const octokit = require('@octokit/rest')()

interface State {
  userValue: string
  users: GitHubUser[]
  repoValue: string
  repos: GitHubRepo[]
  versionValue: string
  versions: GitHubVersions[]
  versionSelected?: GitHubVersions
  token: string
  status: 'initial' | 'loading' | 'done'
  loading: 'none' | 'user' | 'repo'
  step: 'user' | 'repo' | 'version'
}

interface GitHubUser {
  avatar_url: string
  login: string
  id: string
}

interface GitHubRepo {
  description: string
  name: string
  id: string
}

interface GitHubVersions {
  description: string
  name: string
  tag_name: string
  id: string
  published_at: string
  html_url: string
  assets: GitHubVersionAsset[]
}

interface GitHubVersionAsset {
  browser_download_url: string
  name: string
  id: string
}

const CLIENT_ID = "9aa654ac32dd532c5560";
const REDIRECT_URI = "https://repos-finder.netlify.com";
const localStorageKey = "state";

class App extends Component<{}, State> {
  constructor (props: {}) {
    super(props)

    if (localStorage.hasOwnProperty(localStorageKey)) {
      try {
        let value = localStorage.getItem(localStorageKey)
        if (value) {
          this.state = JSON.parse(value) as State;
        }
        return
      } catch (e) { }
    }

    this.state = {
      userValue: '',
      users: [],
      repoValue: '',
      repos: [],
      versionValue: '',
      versions: [],
      token: '',
      status: 'initial',
      step: 'user',
      loading: 'none'
    }
  }

  componentDidMount() {
    let code;
    const found = window.location.href.match(/\?code=(.*)/);
    if (found && found.length > 1) {
      code = found[1];
    }

    if (code) {
      this.setState({ status: 'loading' }, this.persistState);
      // Uses https://github.com/prose/gatekeeper on heroku
      fetch(`https://release-finder-github.herokuapp.com/authenticate/${code}`)
        .then(response => response.json())
        .then(({ token }) => {
          this.setState({
            token,
            status: 'done'
          }, this.persistState);

          octokit.authenticate({
            type: 'oauth',
            token: token
          })

          window.location.href = "/";
        });
    } else if (this.state.token) {
      octokit.authenticate({
        type: 'oauth',
        token: this.state.token
      })
    }
  }

  persistState () {
    localStorage.setItem(localStorageKey, JSON.stringify(this.state));
  }

  fetchUsers (query: string) {
    if (query.length > 1) {
      this.setState({
        loading: 'user'
      })
      octokit.search.users({q: query, order: 'asc', per_page: 100})
      .then((response: any) => {
        this.setState({
          loading: 'none',
          users: []
        })

        if (response.status !== 200 || !response.data) {
          console.log('Looks like there was a problem. Status Code: ' + response.status);
          return;
        }

        if (response.data.total_count > 0) {
          response.data.items.sort((a: GitHubUser, b: GitHubUser) => a.login.length - b.login.length)

          this.setState({
            users: response.data.items,
          }, this.persistState)
        }
      })
    }

    this.setState({
      userValue: query,
      repoValue: "",
      repos: [],
      versionValue: "",
      versions: [],
      versionSelected: undefined
    }, this.persistState)
  }

  fetchRepos (userValue: string, page: number) {
    this.setState({
      loading: 'repo'
    })

    octokit.search.repos({q: `user:${this.state.userValue}`, order: 'asc', per_page: 100, page})
    .then((response: any) => {
      this.setState({
        repos: [],
        loading: 'none'
      })

      if (response.status !== 200 || !response.data) {
        console.log('Looks like there was a problem. Status Code: ' + response.status);
        return;
      }

      let value = []
      if (response.data.total_count > 0) {
        value = response.data.items

        if (page !== 1) {
          value = this.state.versions.concat(value)
        }
      }

      this.setState({
        repos: value
      }, this.persistState)

      if (response.data.length == 100) {
        this.fetchVersions(userValue, page++)
      }
    })

    this.setState({
      versionValue: "",
      versions: [],
      versionSelected: undefined
    }, this.persistState)
  }

  fetchVersions (repoValue: string, page: number) {
    octokit.repos.listReleases({owner: this.state.userValue, repo: repoValue, per_page: 100, page})
    .then((response: any) => {
      if (response.status !== 200 || !response.data) {
        console.log('Looks like there was a problem. Status Code: ' + response.status);
        return;
      }

      let value = []
      if (Array.isArray(response.data) && response.data.length > 0) {
        value = response.data

        if (page !== 1) {
          value = this.state.versions.concat(value)
        }
      }

      this.setState({
        versions: value
      }, this.persistState)

      if (response.data.length == 100) {
        this.fetchVersions(repoValue, page++)
      }
    })
  }

  body () {
    return <>
      User:
      <Autocomplete
        items={this.state.users}
        getItemValue={(item) => item.login}
        shouldItemRender={(item, value) => item.login.toLowerCase().indexOf(value.toLowerCase()) == 0}
        renderItem={(item, isHighlighted) =>
          <div key={item.id} style={{ background: isHighlighted ? 'lightgray' : 'white' }}>
            {item.login}
          </div>
        }
        value={this.state.userValue}
        onChange={e => {
          const value = e.target.value
          this.fetchUsers(value)
          this.setState({ step: "repo" }, this.persistState)
        }}
        onSelect={userValue => {
          this.fetchRepos(userValue, 1)
          this.setState({ userValue, step: "repo", repos: [] }, this.persistState)
        }}
        inputProps={{style: {width: '200px'}}}
      />
      {
        this.state.loading === 'user' ? "Loading" : null
      }
      <br/>
      {
        this.state.step !== "user"
        ? <>
          Repo:
          <Autocomplete
            items={this.state.repos}
            getItemValue={(item) => item.name}
            shouldItemRender={(item, value) => item.name.toLowerCase().indexOf(value.toLowerCase()) > -1}
            renderItem={(item, isHighlighted) =>
              <div key={item.id} style={{ background: isHighlighted ? 'lightgray' : 'white' }}>
                {item.name}
              </div>
            }
            value={this.state.repoValue}
            onChange={e => this.setState({ repoValue: e.target.value, step: "version" }, this.persistState)}
            onSelect={repoValue => {
              this.setState({ repoValue, step: "version", versions: [], versionSelected: undefined }, this.persistState)
              this.fetchVersions(repoValue, 1)
            }}
            inputProps={{style: {width: '200px'}}}
          />
          {
            this.state.loading === 'repo' ? "Loading" : null
          }
          <br/>
        </>
        : null
      }
      {
        this.state.step === "version" && this.state.versions.length > 0
        ? <>
          Version:
          <Autocomplete
            items={this.state.versions}
            getItemValue={(item) => item.name}
            shouldItemRender={(item, value) => item.name.toLowerCase().indexOf(value.toLowerCase()) > -1}
            renderItem={(item, isHighlighted) =>
              <div key={item.id} style={{ background: isHighlighted ? 'lightgray' : 'white' }}>
                {item.name}
              </div>
            }
            value={this.state.versionValue}
            onChange={e => this.setState({ versionValue: e.target.value, versionSelected: undefined }, this.persistState)}
            onSelect={(versionValue, item) => this.setState({ versionValue, versionSelected: item }, this.persistState)}
            inputProps={{style: {width: '200px'}}}
          />
          <br/>
        </>
        : null
      }
      {
        this.state.step === "version" && this.state.versionSelected
        ? <>
          <br/><br/>
          <a href={this.state.versionSelected.html_url} target={"_blank"}>
            {this.state.versionSelected.name} ({this.state.versionSelected.published_at})
          </a>
          <br/><br/>
          {
            this.state.versionSelected.assets.map((item: GitHubVersionAsset) => {
              return <div key={item.id}>
                <a href={item.browser_download_url}>{item.name}</a>
              </div>
            })
          }
        </>
        : null
      }
    </>
  }

  render() {
    return (
      <div>
        {
          this.state.status != "done"
          ? <a href={`https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=user&redirect_uri=${REDIRECT_URI}`}>
            Login
          </a>
          : null
        }
        {
          this.state.status == "done"
          ? this.body()
          : null
        }

      </div>
    );
  }
}

export default App;
