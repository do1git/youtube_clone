import User from "../models/User";
import bcrypt from "bcrypt";
import fetch from "node-fetch";
import session from "express-session";
import { raw } from "express";
import Video from "../models/Video";

export const getJoin = (req, res) => {
  res.render("join", { pageTitle: "join" });
};

export const postJoin = async (req, res) => {
  const { email, username, password, password2, name, location } = req.body;
  console.log(password, password2);
  if (password !== password2) {
    return res.status(400).render("join", {
      pageTitle: "join",
      errorMessage: "PW confirmation not match",
    });
  }

  const exists = await User.exists({
    $or: [{ username: username }, { email }],
  });
  if (exists) {
    return res.status(400).render("join", {
      pageTitle: "join",
      errorMessage: "This username/email is already taken.",
    });
  }
  try {
    await User.create({
      email,
      username,
      password,
      name,
      location,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).render("join", {
      pageTitle: `join`,
      errorMessage: error._message,
    });
  }
  return res.redirect("/login");
};

export const getLogin = (req, res) =>
  res.render("login", { pageTitle: "Login" });

export const postLogin = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, socialOnly: false });
  if (!user) {
    return res
      .status(400)
      .render("login", { pageTitle: "Login", errorMessage: "no username" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res
      .status(400)
      .render("login", { pageTitle: "Login", errorMessage: "Wrong password" });
  }

  req.session.loggedIn = true;
  req.session.user = user;

  res.redirect("/");
};

export const startGithubLogin = (req, res) => {
  const baseUrl = "https://github.com/login/oauth/authorize";
  const config = {
    client_id: process.env.GH_CLIENT,
    allow_signup: false,
    scope: "read:user user:email",
  };
  const params = new URLSearchParams(config).toString();
  const finalUrl = `${baseUrl}?${params}`;
  res.redirect(finalUrl);
};

export const finishGithubLogin = async (req, res) => {
  const baseUrl = "https://github.com/login/oauth/access_token";
  const config = {
    client_id: process.env.GH_CLIENT,
    client_secret: process.env.GH_SECRET,
    code: req.query.code,
  };
  const params = new URLSearchParams(config).toString();
  const finalUrl = `${baseUrl}?${params}`;

  const tokenRequest = await (
    await fetch(finalUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
    })
  ).json();
  if ("access_token" in tokenRequest) {
    const { access_token } = tokenRequest;
    const apiUrl = "https://api.github.com";
    const userData = await (
      await fetch(`${apiUrl}/user`, {
        headers: {
          Authorization: `token ${access_token}`,
        },
      })
    ).json();

    const emailData = await (
      await fetch(`${apiUrl}/user/emails`, {
        headers: {
          Authorization: `token ${access_token}`,
        },
      })
    ).json();
    const emailObj = emailData.find(
      (email) => email.primary === true && email.verified === true
    );
    if (!emailObj) {
      //no email
      return res.redirect("/login");
    }
    let user = await User.findOne({ email: emailObj.email });
    if (!user) {
      user = await User.create({
        name: userData.name,
        avatarUrl: userData.avatar_url,
        username: userData.login,
        email: emailObj.email,
        password: "",
        socialOnly: true,
        location: userData.location,
      });
    }
    req.session.loggedIn = true;
    req.session.user = user;
    return res.redirect("/");
  } else {
    console.log("22222");

    return res.redirect("/login");
  }
};

export const logout = (req, res) => {
  req.session.destroy();
  res.flash("info", "byebye~^^");
  return res.redirect("/");
};

export const getEdit = (req, res) => {
  return res.render("edit-profile", { pageTitle: "Edit profile" });
};
export const postEdit = async (req, res) => {
  const {
    session: {
      user: {
        _id,
        avatarUrl,
        email: originalEmail,
        username: originalUsername,
      },
    },
    body: { name, email: changedEmail, username: changedUsername, location },
    file,
  } = req;

  console.log(file);

  let searchList = [];
  if (changedEmail !== originalEmail) {
    searchList.push({ email: changedEmail });
  }
  if (changedUsername !== originalUsername) {
    searchList.push({ username: changedUsername });
  }

  if (searchList.length > 0) {
    const exists = await User.exists({ $or: searchList });
    if (exists) {
      return res.status(400).render("edit-profile", {
        pageTitle: "Edit profile",
        errorMessage: "This username/email is already taken.",
      });
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    _id,
    {
      avatarUrl: file ? file.path : avatarUrl,
      name,
      email: changedEmail,
      username: changedUsername,
      location,
    },
    { new: true }
  );
  req.session.user = updatedUser;
  return res.redirect("/users/edit");
};
export const remove = (req, res) => res.send("Remove User");

export const see = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).populate("videos");
  if (!user) {
    return res.status(404).render("404", { pageTitle: "User not found" });
  }
  res.render("users/profile", {
    pageTitle: `${user.name}'s profile`,
    user,
  });
};

export const getChangePassword = (req, res) => {
  if (req.session.user.socialOnly === true) {
    req.flash("error", "cant change password");
    return res.redirect("/");
  }
  return res.render("users/change-password", { pageTitle: "Change Password" });
};

export const postChangePassword = async (req, res) => {
  const {
    session: {
      user: { _id, password },
    },
    body: { oldPassword, newPassword, newConfirm },
  } = req;
  const ok = await bcrypt.compare(oldPassword, password);
  if (!ok) {
    return res.status(400).render("users/change-password", {
      pageTitle: "Change Password",
      errorMessage: "old doesn't match",
    });
  }

  if (newPassword !== newConfirm) {
    return res.status(400).render("users/change-password", {
      pageTitle: "Change Password",
      errorMessage: "new doesn't match",
    });
  }
  const user = await User.findById(_id);
  user.password = newPassword;
  await user.save();
  req.session.user.password = user.password;
  // send noti
  req.flash("info", "PW updated");
  return res.redirect("/users/logout");
};
