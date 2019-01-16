import React, { Component } from 'react';
import Autocomplete from 'react-autocomplete';
import './App.css';

interface State {
  userValue: string
  users: GitHubUser[]
  repoValue: string
  repos: GitHubRepo[]
  versionValue: string
  versions: GitHubVersions[]
  token: string
  status: 'initial' | 'loading' | 'done'
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
}

const CLIENT_ID = "9aa654ac32dd532c5560";
const REDIRECT_URI = "http://localhost:3000/";
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
        step: 'user'
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

          window.location.href = "/";
        });
    }
  }

  persistState () {
    localStorage.setItem(localStorageKey, JSON.stringify(this.state));
  }

  fetchUsers (query: string) {
    if (query.length > 3) {
      fetch(`https://api.github.com/search/users?q=${query}&access_token=${this.state.token}&order=asc`)
      .then((response: Response) => {
        if (response.status !== 200) {
          console.log('Looks like there was a problem. Status Code: ' + response.status);
          return;
        }

        response.json().then(data => {
          if (data.items) {
            this.setState({
              users: data.items
            }, this.persistState)
          }
        });
      })
    }

    this.setState({
      userValue: query,
      repoValue: "",
      versionValue: ""
    }, this.persistState)
  }

  fetchRepos (query: string) {
    if (query.length > 3) {
      fetch(`https://api.github.com/search/repositories?q=${query}:user:${this.state.userValue}&access_token=${this.state.token}&order=asc`)
      .then((response: Response) => {
        if (response.status !== 200) {
          console.log('Looks like there was a problem. Status Code: ' + response.status);
          return;
        }

        response.json().then(data => {
          if (data.items) {
            this.setState({
              repos: data.items
            }, this.persistState)
          }
        });
      })
    }

    this.setState({
      repoValue: query,
      versionValue: ""
    }, this.persistState)
  }

  fetchVersions (query: string) {
    if (query.length > 0) {
      fetch(`https://api.github.com/repos/${this.state.userValue}/${this.state.repoValue}/releases?access_token=${this.state.token}&order=asc`)
      .then((response: Response) => {
        if (response.status !== 200) {
          console.log('Looks like there was a problem. Status Code: ' + response.status);
          return;
        }

        response.json().then(data => {
          if (Array.isArray(data)) {
            this.setState({
              versions: data
            }, this.persistState)
          }
        });
      })
    }

    this.setState({
      versionValue: query
    }, this.persistState)
  }

  body () {
    return <>
      User:
      <Autocomplete
          getItemValue={(item) => item.login}
          items={this.state.users}
          renderItem={(item, isHighlighted) =>
            <div key={item.id} style={{ background: isHighlighted ? 'lightgray' : 'white' }}>
              {item.login}
            </div>
          }
          value={this.state.userValue}
          onChange={e => this.fetchUsers(e.target.value)}
          onSelect={userValue => this.setState({ userValue, step: "repo" }, this.persistState)}
        /> <br/>
      {
        this.state.step !== "user"
        ? <>
          Repo:
          <Autocomplete
              getItemValue={(item) => item.name}
              items={this.state.repos}
              renderItem={(item, isHighlighted) =>
                <div key={item.id} style={{ background: isHighlighted ? 'lightgray' : 'white' }}>
                  {item.name}
                </div>
              }
              value={this.state.repoValue}
              onChange={e => this.fetchRepos(e.target.value)}
              onSelect={repoValue => this.setState({ repoValue, step: "version" }, this.persistState)}
            /> <br/>
        </>
        : null
      }
      {
        this.state.step === "version"
        ? <>
          Version:
          <Autocomplete
              getItemValue={(item) => item.tag_name}
              items={this.state.versions}
              renderItem={(item, isHighlighted) =>
                <div key={item.id} style={{ background: isHighlighted ? 'lightgray' : 'white' }}>
                  {item.name}
                </div>
              }
              value={this.state.versionValue}
              onChange={e => this.fetchVersions(e.target.value)}
              onSelect={versionValue => this.setState({ versionValue, step: "version" }, this.persistState)}
            /> <br/>
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
