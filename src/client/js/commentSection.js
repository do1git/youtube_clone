import fetch from "node-fetch";

const form = document.getElementById("commentForm");
const videoContainer = document.getElementById("videoContainer");

const addComment = (text) => {
  const videoComments = document.querySelector(".video__comments ul");
  const newComment = document.createElement("li");
  newComment.className = "video__comment";
  const span = document.createElement("span");
  span.innerText = `${text}`;
  console.log(newComment);
  newComment.appendChild(span);
  videoComments.prepend(newComment);
};

const handleSubmit = async (event) => {
  const textarea = form.querySelector("textarea");
  event.preventDefault();
  const text = textarea.value;
  const video = videoContainer.dataset.id;
  if (text === "") {
    return;
  }
  const response = await fetch(`/api/videos/${video}/comment`, {
    method: "POST",
    headers: { "Content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const status = response.status;
  textarea.value = "";
  if (status === 201) {
    addComment(text);
  }
  //window.location.reload();
};
if (form) {
  form.addEventListener("submit", handleSubmit);
}
